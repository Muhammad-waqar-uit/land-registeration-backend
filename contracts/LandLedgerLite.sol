// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LandLedgerLite
 * @notice Minimal, storage-focused ledger to mirror backend state on-chain.
 *         - No complex validation or business rules.
 *         - Backend (admin) is trusted and writes records.
 *         - Used to record properties, sales/resales, and token payments.
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract LandLedgerLite {
    // ----------------------------------------------------------------------
    // Admin / access control
    // ----------------------------------------------------------------------

    address public admin;

    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address _admin) {
        require(_admin != address(0), "Admin required");
        admin = _admin;
        emit AdminChanged(address(0), _admin);
    }

    function setAdmin(address _admin) external onlyAdmin {
        require(_admin != address(0), "Admin required");
        emit AdminChanged(admin, _admin);
        admin = _admin;
    }

    // ----------------------------------------------------------------------
    // Basic user / builder registry (optional)
    // ----------------------------------------------------------------------

    enum UserRole {
        None,
        User,
        Builder,
        Admin
    }

    struct UserRecord {
        UserRole role;
        bytes32 offchainId; // e.g. hash/UUID from your DB
    }

    mapping(address => UserRecord) public users;

    event UserRegistered(address indexed wallet, UserRole role, bytes32 offchainId);
    event UserRoleUpdated(address indexed wallet, UserRole oldRole, UserRole newRole);

    function registerOrUpdateUser(
        address wallet,
        UserRole role,
        bytes32 offchainId
    ) external onlyAdmin {
        UserRole oldRole = users[wallet].role;
        users[wallet] = UserRecord({role: role, offchainId: offchainId});

        if (oldRole == UserRole.None) {
            emit UserRegistered(wallet, role, offchainId);
        } else {
            emit UserRoleUpdated(wallet, oldRole, role);
        }
    }

    // ----------------------------------------------------------------------
    // Properties
    // ----------------------------------------------------------------------

    struct PropertyRecord {
        // Local ID inside this contract (auto-increment)
        uint256 id;
        // External identifier from your backend (e.g. UUID of land row)
        bytes32 offchainId;
        // Builder that created the project/property (can be backend-defined)
        address builder;
        // Current owner (builder or buyer)
        address currentOwner;
        // Whether this property is currently flagged as resale in your system
        bool isResale;
    }

    uint256 public nextPropertyId = 1;
    mapping(uint256 => PropertyRecord) public properties;

    // Map from offchain land ID (hash/UUID) to on-chain propertyId (optional helper)
    mapping(bytes32 => uint256) public propertyIdByOffchainId;

    event PropertyRegistered(
        uint256 indexed propertyId,
        bytes32 indexed offchainId,
        address indexed builder,
        address currentOwner
    );

    event PropertyOwnerUpdated(
        uint256 indexed propertyId,
        address indexed oldOwner,
        address indexed newOwner,
        bool isResale
    );

    /**
     * @notice Register a new property on-chain (mirror of backend land record).
     * @param offchainId  Hash/UUID of the property in your DB (e.g. land.id).
     * @param builder     Builder wallet (or backend-designated address).
     * @param currentOwner Initial owner (usually builder).
     */
    function registerProperty(
        bytes32 offchainId,
        address builder,
        address currentOwner
    ) external onlyAdmin returns (uint256 propertyId) {
        require(builder != address(0), "Builder required");
        require(currentOwner != address(0), "Owner required");

        propertyId = nextPropertyId++;
        PropertyRecord storage p = properties[propertyId];
        p.id = propertyId;
        p.offchainId = offchainId;
        p.builder = builder;
        p.currentOwner = currentOwner;
        p.isResale = false;

        propertyIdByOffchainId[offchainId] = propertyId;

        emit PropertyRegistered(propertyId, offchainId, builder, currentOwner);
    }

    /**
     * @notice Update property owner (for sale / resale). Ledger only stores data.
     */
    function updatePropertyOwner(
        uint256 propertyId,
        address newOwner,
        bool isResale
    ) external onlyAdmin {
        PropertyRecord storage p = properties[propertyId];
        require(p.id != 0, "Property not found");

        address oldOwner = p.currentOwner;
        p.currentOwner = newOwner;
        p.isResale = isResale;

        emit PropertyOwnerUpdated(propertyId, oldOwner, newOwner, isResale);
    }

    /**
     * @notice Update property owner by offchain land ID. If property not on ledger, registers it first.
     */
    function updatePropertyOwnerByOffchainId(
        bytes32 offchainLandId,
        address builder,
        address newOwner,
        bool isResale
    ) external onlyAdmin {
        uint256 propertyId = propertyIdByOffchainId[offchainLandId];
        if (propertyId == 0) {
            require(builder != address(0), "Builder required");
            propertyId = nextPropertyId++;
            PropertyRecord storage p = properties[propertyId];
            p.id = propertyId;
            p.offchainId = offchainLandId;
            p.builder = builder;
            p.currentOwner = builder;
            p.isResale = false;
            propertyIdByOffchainId[offchainLandId] = propertyId;
            emit PropertyRegistered(propertyId, offchainLandId, builder, builder);
        }
        PropertyRecord storage pr = properties[propertyId];
        address oldOwner = pr.currentOwner;
        pr.currentOwner = newOwner;
        pr.isResale = isResale;
        emit PropertyOwnerUpdated(propertyId, oldOwner, newOwner, isResale);
    }

    // ----------------------------------------------------------------------
    // Trades (sale & resale flows)
    // ----------------------------------------------------------------------

    struct TradeRecord {
        uint256 id;
        uint256 propertyId;
        address seller;
        address buyer;
        uint256 price;          // in token units (or fiat-equivalent, backend decides)
        bool isResale;
        bytes32 offchainAgreementId; // link to your Agreement entity (UUID/hash)
        uint64 timestamp;
    }

    uint256 public nextTradeId = 1;
    mapping(uint256 => TradeRecord) public trades;

    // Optional reverse index: agreements -> trade
    mapping(bytes32 => uint256) public tradeIdByAgreementOffchainId;

    event TradeRecorded(
        uint256 indexed tradeId,
        uint256 indexed propertyId,
        address indexed seller,
        address buyer,
        uint256 price,
        bool isResale,
        bytes32 offchainAgreementId
    );

    /**
     * @notice Record a sale or resale trade.
     *         Ledger only stores IDs; no business-rule enforcement.
     */
    function recordTrade(
        uint256 propertyId,
        address seller,
        address buyer,
        uint256 price,
        bool isResale,
        bytes32 offchainAgreementId
    ) external onlyAdmin returns (uint256 tradeId) {
        require(properties[propertyId].id != 0, "Property not found");

        tradeId = _recordTrade(propertyId, seller, buyer, price, isResale, offchainAgreementId);
    }

    /**
     * @notice Record a trade by offchain land ID. If the property is not yet on ledger, it is registered first.
     *         Ledger only records IDs; no extra rule enforcement.
     */
    function recordTradeByOffchainId(
        bytes32 offchainLandId,
        address builder,
        address seller,
        address buyer,
        uint256 price,
        bool isResale,
        bytes32 offchainAgreementId
    ) external onlyAdmin returns (uint256 tradeId) {
        uint256 propertyId = propertyIdByOffchainId[offchainLandId];
        if (propertyId == 0) {
            require(builder != address(0) && seller != address(0), "Builder and seller required");
            propertyId = nextPropertyId++;
            PropertyRecord storage p = properties[propertyId];
            p.id = propertyId;
            p.offchainId = offchainLandId;
            p.builder = builder;
            p.currentOwner = seller;
            p.isResale = isResale;
            propertyIdByOffchainId[offchainLandId] = propertyId;
            emit PropertyRegistered(propertyId, offchainLandId, builder, seller);
        }
        return _recordTrade(propertyId, seller, buyer, price, isResale, offchainAgreementId);
    }

    function _recordTrade(
        uint256 propertyId,
        address seller,
        address buyer,
        uint256 price,
        bool isResale,
        bytes32 offchainAgreementId
    ) internal returns (uint256 tradeId) {
        tradeId = nextTradeId++;
        TradeRecord storage t = trades[tradeId];
        t.id = tradeId;
        t.propertyId = propertyId;
        t.seller = seller;
        t.buyer = buyer;
        t.price = price;
        t.isResale = isResale;
        t.offchainAgreementId = offchainAgreementId;
        t.timestamp = uint64(block.timestamp);

        if (offchainAgreementId != bytes32(0)) {
            tradeIdByAgreementOffchainId[offchainAgreementId] = tradeId;
        }

        emit TradeRecorded(
            tradeId,
            propertyId,
            seller,
            buyer,
            price,
            isResale,
            offchainAgreementId
        );
    }

    // ----------------------------------------------------------------------
    // Token payment records (and optional token transfer helper)
    // ----------------------------------------------------------------------

    struct PaymentRecord {
        uint256 id;
        uint256 propertyId;
        uint256 tradeId;            // 0 if not linked to a specific trade
        address payer;
        address payee;
        address token;              // Optional, not used for transfers in this lite version
        uint256 amount;
        bytes32 offchainPaymentId;  // link to your Payment entity in DB
        uint64 timestamp;
    }

    uint256 public nextPaymentId = 1;
    mapping(uint256 => PaymentRecord) public payments;

    // Simple points balance per address (mimics token balances without real ERC20)
    mapping(address => uint256) public pointBalances;

    event PaymentRecorded(
        uint256 indexed paymentId,
        uint256 indexed tradeId,
        address indexed payer,
        address payee,
        address token,
        uint256 amount,
        bytes32 offchainPaymentId
    );

    event PointsAwarded(address indexed to, uint256 amount);
    event PointsTransferred(address indexed from, address indexed to, uint256 amount);

    /**
     * @notice Admin-only function to mint/award points manually to any address.
     *         This is used by the backend's mint endpoint instead of real ERC20.
     */
    function awardPoints(address to, uint256 amount) external onlyAdmin {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        pointBalances[to] += amount;
        emit PointsAwarded(to, amount);
    }

    /**
     * @notice Admin-only: transfer points from one address to another (e.g. buyer pays seller with points).
     *         Used for payment mode POINTS.
     */
    function transferPoints(address from, address to, uint256 amount) external onlyAdmin {
        require(from != address(0) && to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        require(pointBalances[from] >= amount, "Insufficient points");
        pointBalances[from] -= amount;
        pointBalances[to] += amount;
        emit PointsTransferred(from, to, amount);
    }

    function getBalance(address user) external view returns (uint256) {
        return pointBalances[user];
    }

    /**
     * @notice Record a payment related to a trade/property. Ledger only stores data.
     */
    function recordPayment(
        uint256 propertyId,
        uint256 tradeId,
        address payer,
        address payee,
        address token,
        uint256 amount,
        bytes32 offchainPaymentId
    ) external onlyAdmin returns (uint256 paymentId) {
        require(properties[propertyId].id != 0, "Property not found");
        require(payer != address(0) && payee != address(0), "Invalid parties");
        require(token != address(0), "Token required");
        require(amount > 0, "Amount must be > 0");

        paymentId = _recordPayment(propertyId, tradeId, payer, payee, token, amount, offchainPaymentId);
    }

    /**
     * @notice Record a payment by offchain land ID. If property not on ledger, registers it first.
     */
    function recordPaymentByOffchainId(
        bytes32 offchainLandId,
        address builder,
        uint256 tradeId,
        address payer,
        address payee,
        address token,
        uint256 amount,
        bytes32 offchainPaymentId
    ) external onlyAdmin returns (uint256 paymentId) {
        uint256 propertyId = propertyIdByOffchainId[offchainLandId];
        if (propertyId == 0) {
            require(builder != address(0), "Builder required");
            propertyId = nextPropertyId++;
            PropertyRecord storage pr = properties[propertyId];
            pr.id = propertyId;
            pr.offchainId = offchainLandId;
            pr.builder = builder;
            pr.currentOwner = builder;
            pr.isResale = false;
            propertyIdByOffchainId[offchainLandId] = propertyId;
            emit PropertyRegistered(propertyId, offchainLandId, builder, builder);
        }
        return _recordPayment(propertyId, tradeId, payer, payee, token, amount, offchainPaymentId);
    }

    function _recordPayment(
        uint256 propertyId,
        uint256 tradeId,
        address payer,
        address payee,
        address token,
        uint256 amount,
        bytes32 offchainPaymentId
    ) internal returns (uint256 paymentId) {
        paymentId = nextPaymentId++;
        PaymentRecord storage p = payments[paymentId];
        p.id = paymentId;
        p.propertyId = propertyId;
        p.tradeId = tradeId;
        p.payer = payer;
        p.payee = payee;
        p.token = token;
        p.amount = amount;
        p.offchainPaymentId = offchainPaymentId;
        p.timestamp = uint64(block.timestamp);

        pointBalances[payee] += amount;
        emit PointsAwarded(payee, amount);

        emit PaymentRecorded(
            paymentId,
            tradeId,
            payer,
            payee,
            token,
            amount,
            offchainPaymentId
        );
    }
}


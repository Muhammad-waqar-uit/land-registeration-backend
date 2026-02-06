import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserBankInfoService } from './user-bank-info.service';
import { CreateUserBankInfoDto } from './dto/create-user-bank-info.dto';
import { UpdateUserBankInfoDto } from './dto/update-user-bank-info.dto';
import { UserBankInfoResponseDto } from './dto/user-bank-info-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('User Bank Info')
@Controller('user-bank-info')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserBankInfoController {
  constructor(private readonly userBankInfoService: UserBankInfoService) {}

  @Post()
  @ApiOperation({ summary: 'Add bank info' })
  @ApiResponse({
    status: 201,
    description: 'Bank info created',
    type: UserBankInfoResponseDto,
  })
  create(
    @Body() dto: CreateUserBankInfoDto,
    @CurrentUser() user: User,
  ): Promise<UserBankInfoResponseDto> {
    return this.userBankInfoService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get my bank info list' })
  @ApiResponse({
    status: 200,
    description: 'List of bank info',
    type: [UserBankInfoResponseDto],
  })
  findAll(@CurrentUser() user: User): Promise<UserBankInfoResponseDto[]> {
    return this.userBankInfoService.findAllByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one bank info by ID' })
  @ApiResponse({
    status: 200,
    description: 'Bank info',
    type: UserBankInfoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Bank info not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<UserBankInfoResponseDto> {
    return this.userBankInfoService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update bank info' })
  @ApiResponse({
    status: 200,
    description: 'Bank info updated',
    type: UserBankInfoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Bank info not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserBankInfoDto,
    @CurrentUser() user: User,
  ): Promise<UserBankInfoResponseDto> {
    return this.userBankInfoService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete bank info' })
  @ApiResponse({ status: 200, description: 'Bank info deleted' })
  @ApiResponse({ status: 404, description: 'Bank info not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.userBankInfoService.remove(id, user.id);
  }
}

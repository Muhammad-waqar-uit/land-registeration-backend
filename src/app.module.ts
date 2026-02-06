import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { LandsModule } from './lands/lands.module';
import { PaymentsModule } from './payments/payments.module';
import { ContactModule } from './contact/contact.module';
import { CommonModule } from './common/common.module';
import { BuildersModule } from './builders/builders.module';
import { ProjectsModule } from './projects/projects.module';
import { AgreementsModule } from './agreements/agreements.module';
import { PropertyRequestsModule } from './property-requests/property-requests.module';
import { ResaleRequestsModule } from './resale-requests/resale-requests.module';
import { InstallmentsModule } from './installments/installments.module';
import { TokensModule } from './tokens/tokens.module';
import { BuyersModule } from './buyers/buyers.module';
import { TokenRequestsModule } from './token-requests/token-requests.module';
import { TransferRequestsModule } from './transfer-requests/transfer-requests.module';
import { OwnershipDocumentsModule } from './ownership-documents/ownership-documents.module';
import { UserBankInfoModule } from './user-bank-info/user-bank-info.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    LandsModule,
    PaymentsModule,
    ContactModule,
    CommonModule,
    BuildersModule,
    ProjectsModule,
    AgreementsModule,
    PropertyRequestsModule,
    ResaleRequestsModule,
    InstallmentsModule,
    TokensModule,
    BuyersModule,
    TokenRequestsModule,
    TransferRequestsModule,
    OwnershipDocumentsModule,
    UserBankInfoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

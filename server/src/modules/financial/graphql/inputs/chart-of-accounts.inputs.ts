import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsEnum, IsOptional, IsBoolean, IsUUID, Length } from 'class-validator';
import { AccountType, AccountSubType, NormalBalance } from '../enums';

@InputType()
export class CreateChartOfAccountInput {
  @Field()
  @IsString()
  @Length(1, 20)
  accountNumber!: string;

  @Field()
  @IsString()
  @Length(1, 255)
  accountName!: string;

  @Field(() => AccountType)
  @IsEnum(AccountType)
  accountType!: AccountType;

  @Field(() => AccountSubType)
  @IsEnum(AccountSubType)
  accountSubType!: AccountSubType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @Field(() => NormalBalance)
  @IsEnum(NormalBalance)
  normalBalance!: NormalBalance;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  taxReportingCategory?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  allowManualJournalEntries?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireDepartment?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireProject?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireCustomer?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireSupplier?: boolean;
}

@InputType()
export class UpdateChartOfAccountInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  accountNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  accountName?: string;

  @Field(() => AccountType, { nullable: true })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @Field(() => AccountSubType, { nullable: true })
  @IsOptional()
  @IsEnum(AccountSubType)
  accountSubType?: AccountSubType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @Field(() => NormalBalance, { nullable: true })
  @IsOptional()
  @IsEnum(NormalBalance)
  normalBalance?: NormalBalance;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  taxReportingCategory?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  allowManualJournalEntries?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireDepartment?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireProject?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireCustomer?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireSupplier?: boolean;
}
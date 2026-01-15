import { InputType, Field, ID, Float } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsUUID,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationType, LocationStatus } from '../dto/location.dto';

// Address input
@InputType()
export class AddressInput {
  @Field()
  @IsString()
  @Length(1, 255)
  street!: string;

  @Field()
  @IsString()
  @Length(1, 100)
  city!: string;

  @Field()
  @IsString()
  @Length(1, 100)
  state!: string;

  @Field()
  @IsString()
  @Length(1, 100)
  country!: string;

  @Field()
  @IsString()
  @Length(1, 20)
  postalCode!: string;
}

// Operating hours input
@InputType()
export class DayHoursInput {
  @Field()
  @IsString()
  open!: string;

  @Field()
  @IsString()
  close!: string;

  @Field({ nullable: true })
  @IsOptional()
  closed?: boolean;
}

@InputType()
export class OperatingHoursInput {
  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  monday?: DayHoursInput;

  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  tuesday?: DayHoursInput;

  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  wednesday?: DayHoursInput;

  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  thursday?: DayHoursInput;

  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  friday?: DayHoursInput;

  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  saturday?: DayHoursInput;

  @Field(() => DayHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayHoursInput)
  sunday?: DayHoursInput;
}

// Create location input
@InputType()
export class CreateLocationInput {
  @Field()
  @IsString()
  @Length(1, 255)
  name!: string;

  @Field()
  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Code must contain only uppercase letters, numbers, underscores, and hyphens',
  })
  code!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @Field(() => LocationType)
  @IsEnum(LocationType)
  type!: LocationType;

  @Field(() => LocationStatus, { nullable: true })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @Field(() => AddressInput)
  @ValidateNested()
  @Type(() => AddressInput)
  address!: AddressInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  website?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @Field(() => OperatingHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursInput)
  operatingHours?: OperatingHoursInput;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;
}

// Update location input
@InputType()
export class UpdateLocationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @Field(() => LocationType, { nullable: true })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @Field(() => LocationStatus, { nullable: true })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  address?: AddressInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl()
  website?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @Field(() => OperatingHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => OperatingHoursInput)
  operatingHours?: OperatingHoursInput;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  squareFootage?: number;
}

// Location filter input
@InputType()
export class LocationFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => LocationType, { nullable: true })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @Field(() => LocationStatus, { nullable: true })
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;
}

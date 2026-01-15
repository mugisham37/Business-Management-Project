import { ObjectType, Field, ID, Int, Float, registerEnumType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity, Edge, Connection } from '../../../common/graphql/base.types';
import { LocationType, LocationStatus } from '../dto/location.dto';

// Register enums for GraphQL
registerEnumType(LocationType, {
  name: 'LocationType',
  description: 'Type of location',
});

registerEnumType(LocationStatus, {
  name: 'LocationStatus',
  description: 'Status of location',
});

// Address type
@ObjectType()
export class AddressType {
  @Field()
  @ApiProperty({ description: 'Street address' })
  street!: string;

  @Field()
  @ApiProperty({ description: 'City' })
  city!: string;

  @Field()
  @ApiProperty({ description: 'State or province' })
  state!: string;

  @Field()
  @ApiProperty({ description: 'Country' })
  country!: string;

  @Field()
  @ApiProperty({ description: 'Postal code' })
  postalCode!: string;

  @Field(() => CoordinatesType, { nullable: true })
  @ApiPropertyOptional({ type: CoordinatesType })
  coordinates?: CoordinatesType;
}

@ObjectType()
export class CoordinatesType {
  @Field(() => Float)
  latitude!: number;

  @Field(() => Float)
  longitude!: number;
}

// Operating hours type
@ObjectType()
export class DayHoursType {
  @Field()
  open!: string;

  @Field()
  close!: string;

  @Field({ nullable: true })
  closed?: boolean;
}

@ObjectType()
export class OperatingHoursType {
  @Field(() => DayHoursType, { nullable: true })
  monday?: DayHoursType;

  @Field(() => DayHoursType, { nullable: true })
  tuesday?: DayHoursType;

  @Field(() => DayHoursType, { nullable: true })
  wednesday?: DayHoursType;

  @Field(() => DayHoursType, { nullable: true })
  thursday?: DayHoursType;

  @Field(() => DayHoursType, { nullable: true })
  friday?: DayHoursType;

  @Field(() => DayHoursType, { nullable: true })
  saturday?: DayHoursType;

  @Field(() => DayHoursType, { nullable: true })
  sunday?: DayHoursType;
}

// Location GraphQL type
@ObjectType('Location')
export class LocationGQLType extends BaseEntity {
  @Field(() => ID)
  @ApiProperty({ description: 'Location ID' })
  id!: string;

  @Field()
  @ApiProperty({ description: 'Location name' })
  name!: string;

  @Field()
  @ApiProperty({ description: 'Location code' })
  code!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Location description' })
  description?: string;

  @Field(() => LocationType)
  @ApiProperty({ enum: LocationType, description: 'Location type' })
  locationType!: LocationType;

  @Field(() => LocationStatus)
  @ApiProperty({ enum: LocationStatus, description: 'Location status' })
  status!: LocationStatus;

  @Field(() => AddressType)
  @ApiProperty({ type: AddressType })
  address!: AddressType;

  @Field({ nullable: true })
  @ApiPropertyOptional()
  phone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional()
  email?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional()
  website?: string;

  @Field(() => ID, { nullable: true })
  @ApiPropertyOptional()
  parentLocationId?: string;

  @Field()
  @ApiProperty()
  timezone!: string;

  @Field()
  @ApiProperty()
  currency!: string;

  @Field(() => OperatingHoursType, { nullable: true })
  @ApiPropertyOptional({ type: OperatingHoursType })
  operatingHours?: OperatingHoursType;

  @Field(() => ID, { nullable: true })
  @ApiPropertyOptional()
  managerId?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional()
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional()
  longitude?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional()
  squareFootage?: number;

  @Field()
  @ApiProperty()
  isActive!: boolean;

  // Field resolvers will populate these
  @Field(() => LocationGQLType, { nullable: true })
  parentLocation?: LocationGQLType;

  @Field(() => [LocationGQLType], { nullable: true })
  childLocations?: LocationGQLType[];

  @Field(() => [EmployeeType], { nullable: true })
  employees?: EmployeeType[];

  @Field(() => [InventoryType], { nullable: true })
  inventory?: InventoryType[];
}

// Placeholder types for relationships
@ObjectType()
export class EmployeeType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class InventoryType {
  @Field(() => ID)
  id!: string;

  @Field()
  productId!: string;
}

// Connection types
@ObjectType()
export class LocationEdge extends Edge<LocationGQLType> {
  @Field(() => LocationGQLType)
  @ApiProperty({ type: LocationGQLType })
  node!: LocationGQLType;
}

@ObjectType()
export class LocationConnection extends Connection<LocationGQLType> {
  @Field(() => [LocationEdge])
  @ApiProperty({ type: [LocationEdge] })
  edges!: LocationEdge[];
}

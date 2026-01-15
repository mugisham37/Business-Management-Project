import { ObjectType, Field, ID, InputType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';

// Enums
export enum EDIDocumentType {
  PURCHASE_ORDER = '850',
  PURCHASE_ORDER_ACKNOWLEDGMENT = '855',
  ADVANCE_SHIP_NOTICE = '856',
  INVOICE = '810',
  FUNCTIONAL_ACKNOWLEDGMENT = '997',
  INVENTORY_INQUIRY = '846',
  PRICE_CATALOG = '832',
}

export enum EDITransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  ACKNOWLEDGED = 'acknowledged',
}

export enum EDIDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

registerEnumType(EDIDocumentType, { name: 'EDIDocumentType' });
registerEnumType(EDITransactionStatus, { name: 'EDITransactionStatus' });
registerEnumType(EDIDirection, { name: 'EDIDirection' });

// Object Types
@ObjectType('EDIDocument')
export class EDIDocumentType {
  @Field(() => ID)
  @ApiProperty({ description: 'Document ID' })
  id!: string;

  @Field(() => ID)
  @ApiProperty({ description: 'Supplier ID' })
  supplierId!: string;

  @Field(() => EDIDocumentType)
  @ApiProperty({ description: 'Document type', enum: EDIDocumentType })
  documentType!: EDIDocumentType;

  @Field(() => EDIDirection)
  @ApiProperty({ description: 'Direction', enum: EDIDirection })
  direction!: EDIDirection;

  @Field(() => EDITransactionStatus)
  @ApiProperty({ description: 'Status', enum: EDITransactionStatus })
  status!: EDITransactionStatus;

  @Field()
  @ApiProperty({ description: 'Raw content' })
  rawContent!: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @ApiProperty({ description: 'Parsed content', required: false })
  parsedContent?: any;

  @Field(() => ID, { nullable: true })
  @ApiProperty({ description: 'Related entity ID', required: false })
  relatedEntityId?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Error message', required: false })
  errorMessage?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Processed at', required: false })
  processedAt?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Acknowledged at', required: false })
  acknowledgedAt?: Date;

  @Field()
  @ApiProperty({ description: 'Created at' })
  createdAt!: Date;

  @Field()
  @ApiProperty({ description: 'Updated at' })
  updatedAt!: Date;
}

@ObjectType('EDIStatus')
export class EDIStatusType {
  @Field(() => ID)
  @ApiProperty({ description: 'Document ID' })
  documentId!: string;

  @Field(() => EDITransactionStatus)
  @ApiProperty({ description: 'Status', enum: EDITransactionStatus })
  status!: EDITransactionStatus;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Error message', required: false })
  errorMessage?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Processed at', required: false })
  processedAt?: Date;
}

@ObjectType('EDIJobResponse')
export class EDIJobResponseType {
  @Field(() => ID)
  @ApiProperty({ description: 'Job ID' })
  jobId!: string;

  @Field(() => ID)
  @ApiProperty({ description: 'Document ID' })
  documentId!: string;

  @Field()
  @ApiProperty({ description: 'Message' })
  message!: string;
}

// Input Types
@InputType()
export class SendEDIDocumentInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @Field(() => EDIDocumentType)
  @IsEnum(EDIDocumentType)
  documentType!: EDIDocumentType;

  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  entityId!: string;
}

@InputType()
export class ReceiveEDIDocumentInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @Field(() => EDIDocumentType)
  @IsEnum(EDIDocumentType)
  documentType!: EDIDocumentType;

  @Field()
  @IsString()
  @IsNotEmpty()
  rawContent!: string;
}

@InputType()
export class RetryEDIDocumentInput {
  @Field(() => ID)
  @IsUUID()
  @IsNotEmpty()
  documentId!: string;
}

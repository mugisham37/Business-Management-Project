import { ObjectType, Field, ID, Float, registerEnumType } from '@nestjs/graphql';
import { BaseEntity } from '../../../common/graphql/base.types';

// Register enums for GraphQL
export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_APPROVAL = 'pending_approval',
  SUSPENDED = 'suspended',
  BLACKLISTED = 'blacklisted',
}

export enum SupplierType {
  MANUFACTURER = 'manufacturer',
  DISTRIBUTOR = 'distributor',
  WHOLESALER = 'wholesaler',
  SERVICE_PROVIDER = 'service_provider',
  CONTRACTOR = 'contractor',
  CONSULTANT = 'consultant',
}

export enum SupplierRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  POOR = 'poor',
  UNRATED = 'unrated',
}

export enum CommunicationType {
  EMAIL = 'email',
  PHONE = 'phone',
  MEETING = 'meeting',
  VIDEO_CALL = 'video_call',
  CHAT = 'chat',
  LETTER = 'letter',
  FAX = 'fax',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

registerEnumType(SupplierStatus, {
  name: 'SupplierStatus',
  description: 'Status of the supplier',
});

registerEnumType(SupplierType, {
  name: 'SupplierType',
  description: 'Type of supplier',
});

registerEnumType(SupplierRating, {
  name: 'SupplierRating',
  description: 'Rating of the supplier',
});

registerEnumType(CommunicationType, {
  name: 'CommunicationType',
  description: 'Type of communication',
});

registerEnumType(CommunicationDirection, {
  name: 'CommunicationDirection',
  description: 'Direction of communication',
});

@ObjectType()
export class Supplier extends BaseEntity {
  @Field()
  supplierCode: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  legalName?: string;

  @Field(() => SupplierType)
  supplierType: SupplierType;

  @Field(() => SupplierStatus)
  status: SupplierStatus;

  // Contact Information
  @Field({ nullable: true })
  primaryContactName?: string;

  @Field({ nullable: true })
  primaryContactTitle?: string;

  @Field({ nullable: true })
  primaryContactEmail?: string;

  @Field({ nullable: true })
  primaryContactPhone?: string;

  // Address Information
  @Field({ nullable: true })
  addressLine1?: string;

  @Field({ nullable: true })
  addressLine2?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  state?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field({ nullable: true })
  country?: string;

  // Business Information
  @Field({ nullable: true })
  taxId?: string;

  @Field({ nullable: true })
  businessRegistrationNumber?: string;

  @Field({ nullable: true })
  website?: string;

  @Field({ nullable: true })
  description?: string;

  // Financial Information
  @Field({ nullable: true })
  paymentTerms?: string;

  @Field(() => Float, { nullable: true })
  creditLimit?: number;

  @Field({ nullable: true })
  currency?: string;

  // Performance Metrics
  @Field(() => SupplierRating)
  overallRating: SupplierRating;

  @Field(() => Float, { nullable: true })
  qualityRating?: number;

  @Field(() => Float, { nullable: true })
  deliveryRating?: number;

  @Field(() => Float, { nullable: true })
  serviceRating?: number;

  // Additional Information
  @Field(() => [String])
  certifications: string[];

  @Field(() => [String])
  tags: string[];

  @Field({ nullable: true })
  notes?: string;

  @Field(() => CommunicationType)
  preferredCommunicationMethod: CommunicationType;

  @Field()
  isPreferredSupplier: boolean;

  @Field({ nullable: true })
  lastEvaluationDate?: Date;

  @Field({ nullable: true })
  nextEvaluationDate?: Date;

  // Relations
  @Field(() => [SupplierContact])
  contacts: SupplierContact[];

  @Field(() => [SupplierCommunication])
  communications: SupplierCommunication[];

  @Field(() => [SupplierEvaluation])
  evaluations: SupplierEvaluation[];

  @Field(() => [SupplierPerformanceMetrics])
  performanceMetrics: SupplierPerformanceMetrics[];
}

@ObjectType()
export class SupplierContact extends BaseEntity {
  @Field()
  supplierId: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  department?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  mobile?: string;

  @Field({ nullable: true })
  fax?: string;

  @Field()
  isPrimary: boolean;

  @Field(() => CommunicationType)
  preferredContactMethod: CommunicationType;

  @Field({ nullable: true })
  notes?: string;

  // Relations
  @Field(() => Supplier)
  supplier: Supplier;
}

@ObjectType()
export class SupplierCommunication extends BaseEntity {
  @Field()
  supplierId: string;

  @Field({ nullable: true })
  contactId?: string;

  @Field(() => CommunicationType)
  type: CommunicationType;

  @Field(() => CommunicationDirection)
  direction: CommunicationDirection;

  @Field({ nullable: true })
  subject?: string;

  @Field({ nullable: true })
  content?: string;

  @Field({ nullable: true })
  fromName?: string;

  @Field({ nullable: true })
  fromEmail?: string;

  @Field({ nullable: true })
  toName?: string;

  @Field({ nullable: true })
  toEmail?: string;

  @Field()
  communicationDate: Date;

  @Field()
  followUpRequired: boolean;

  @Field({ nullable: true })
  followUpDate?: Date;

  @Field(() => [String])
  tags: string[];

  // Relations
  @Field(() => Supplier)
  supplier: Supplier;

  @Field(() => SupplierContact, { nullable: true })
  contact?: SupplierContact;
}

@ObjectType()
export class SupplierEvaluation extends BaseEntity {
  @Field()
  supplierId: string;

  @Field()
  evaluationPeriodStart: Date;

  @Field()
  evaluationPeriodEnd: Date;

  @Field()
  evaluationDate: Date;

  @Field()
  evaluatorId: string;

  @Field(() => Float)
  overallScore: number;

  @Field(() => SupplierRating)
  overallRating: SupplierRating;

  @Field(() => Float, { nullable: true })
  qualityScore?: number;

  @Field(() => Float, { nullable: true })
  deliveryScore?: number;

  @Field(() => Float, { nullable: true })
  pricingScore?: number;

  @Field(() => Float, { nullable: true })
  serviceScore?: number;

  @Field(() => Float, { nullable: true })
  reliabilityScore?: number;

  @Field(() => Float, { nullable: true })
  complianceScore?: number;

  @Field(() => Float, { nullable: true })
  onTimeDeliveryRate?: number;

  @Field(() => Float, { nullable: true })
  qualityDefectRate?: number;

  @Field({ nullable: true })
  responseTime?: number;

  @Field({ nullable: true })
  strengths?: string;

  @Field({ nullable: true })
  weaknesses?: string;

  @Field({ nullable: true })
  recommendations?: string;

  @Field()
  isApproved: boolean;

  @Field({ nullable: true })
  approvedBy?: string;

  @Field({ nullable: true })
  approvedAt?: Date;

  // Relations
  @Field(() => Supplier)
  supplier: Supplier;
}

@ObjectType()
export class SupplierPerformanceMetrics extends BaseEntity {
  @Field()
  supplierId: string;

  @Field()
  periodStart: Date;

  @Field()
  periodEnd: Date;

  @Field()
  totalOrders: number;

  @Field()
  completedOrders: number;

  @Field()
  cancelledOrders: number;

  @Field()
  onTimeDeliveries: number;

  @Field()
  lateDeliveries: number;

  @Field(() => Float, { nullable: true })
  averageDeliveryTime?: number;

  @Field()
  totalItemsReceived: number;

  @Field()
  defectiveItems: number;

  @Field()
  returnedItems: number;

  @Field(() => Float)
  totalSpend: number;

  @Field(() => Float, { nullable: true })
  averageOrderValue?: number;

  @Field(() => Float)
  costSavings: number;

  @Field(() => Float, { nullable: true })
  averageResponseTime?: number;

  @Field()
  communicationCount: number;

  @Field(() => Float, { nullable: true })
  completionRate?: number;

  @Field(() => Float, { nullable: true })
  onTimeDeliveryRate?: number;

  @Field(() => Float, { nullable: true })
  qualityRate?: number;

  // Relations
  @Field(() => Supplier)
  supplier: Supplier;
}
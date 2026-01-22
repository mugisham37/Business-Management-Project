export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  BigInt: { input: bigint; output: bigint };
  DateTime: { input: Date; output: Date };
  Decimal: { input: number; output: number };
  JSON: { input: Record<string, any>; output: Record<string, any> };
  Upload: { input: File; output: File };
};

export type AuthResult = {
  __typename?: 'AuthResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  tokens?: Maybe<TokenPair>;
  user?: Maybe<User>;
};

export type BrandingConfig = {
  __typename?: 'BrandingConfig';
  favicon?: Maybe<Scalars['String']['output']>;
  logo?: Maybe<Scalars['String']['output']>;
  primaryColor?: Maybe<Scalars['String']['output']>;
  secondaryColor?: Maybe<Scalars['String']['output']>;
};

export enum BusinessTier {
  Enterprise = 'ENTERPRISE',
  Medium = 'MEDIUM',
  Micro = 'MICRO',
  Small = 'SMALL',
}

export type CreateUserInput = {
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  password: Scalars['String']['input'];
  role: Scalars['String']['input'];
  tenantId: Scalars['ID']['input'];
};

export type CreateUserResult = MutationResponse & {
  __typename?: 'CreateUserResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  user?: Maybe<User>;
};

export type DeleteUserResult = MutationResponse & {
  __typename?: 'DeleteUserResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type FeatureFlag = {
  __typename?: 'FeatureFlag';
  config?: Maybe<Scalars['JSON']['output']>;
  enabled: Scalars['Boolean']['output'];
  key: Scalars['String']['output'];
  requiredTier: BusinessTier;
};

export type LoginInput = {
  email: Scalars['String']['input'];
  mfaCode?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
  rememberMe?: InputMaybe<Scalars['Boolean']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createUser: CreateUserResult;
  deleteUser: DeleteUserResult;
  login: AuthResult;
  logout: AuthResult;
  refreshToken: AuthResult;
  switchTenant: AuthResult;
  toggleFeatureFlag: MutationResponse;
  updateTenantSettings: MutationResponse;
  updateUser: UpdateUserResult;
};

export type MutationCreateUserArgs = {
  input: CreateUserInput;
};

export type MutationDeleteUserArgs = {
  id: Scalars['ID']['input'];
};

export type MutationLoginArgs = {
  input: LoginInput;
};

export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};

export type MutationSwitchTenantArgs = {
  tenantId: Scalars['ID']['input'];
};

export type MutationToggleFeatureFlagArgs = {
  enabled: Scalars['Boolean']['input'];
  key: Scalars['String']['input'];
};

export type MutationUpdateTenantSettingsArgs = {
  settings: Scalars['JSON']['input'];
  tenantId: Scalars['ID']['input'];
};

export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};

export type MutationResponse = {
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PaginationInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type Query = {
  __typename?: 'Query';
  currentTenant?: Maybe<Tenant>;
  currentUser?: Maybe<User>;
  featureFlag?: Maybe<FeatureFlag>;
  featureFlags: Array<FeatureFlag>;
  health: Scalars['String']['output'];
  tenant?: Maybe<Tenant>;
  tenants: Array<Tenant>;
  user?: Maybe<User>;
  users: UserConnection;
};

export type QueryFeatureFlagArgs = {
  key: Scalars['String']['input'];
};

export type QueryTenantArgs = {
  id: Scalars['ID']['input'];
};

export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueryUsersArgs = {
  filter?: InputMaybe<UserFilter>;
  pagination?: InputMaybe<PaginationInput>;
};

export type Subscription = {
  __typename?: 'Subscription';
  featureFlagUpdates: FeatureFlag;
  tenantUpdates: TenantUpdate;
  userStatusUpdates: UserStatusUpdate;
};

export type SubscriptionFeatureFlagUpdatesArgs = {
  tenantId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionTenantUpdatesArgs = {
  tenantId: Scalars['ID']['input'];
};

export type SubscriptionUserStatusUpdatesArgs = {
  tenantId?: InputMaybe<Scalars['ID']['input']>;
};

export type Tenant = {
  __typename?: 'Tenant';
  branding?: Maybe<BrandingConfig>;
  businessTier: BusinessTier;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  settings: TenantSettings;
  subdomain: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TenantLimits = {
  __typename?: 'TenantLimits';
  maxApiCalls: Scalars['Int']['output'];
  maxIntegrations: Scalars['Int']['output'];
  maxStorage: Scalars['BigInt']['output'];
  maxUsers: Scalars['Int']['output'];
};

export type TenantSettings = {
  __typename?: 'TenantSettings';
  currency: Scalars['String']['output'];
  dateFormat: Scalars['String']['output'];
  features: Scalars['JSON']['output'];
  language: Scalars['String']['output'];
  limits: TenantLimits;
  timezone: Scalars['String']['output'];
};

export type TenantUpdate = {
  __typename?: 'TenantUpdate';
  data: Scalars['JSON']['output'];
  tenantId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  type: Scalars['String']['output'];
};

export type TokenPair = {
  __typename?: 'TokenPair';
  accessToken: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  refreshToken: Scalars['String']['output'];
};

export type UpdateUserInput = {
  avatar?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserResult = MutationResponse & {
  __typename?: 'UpdateUserResult';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  user?: Maybe<User>;
};

export type User = {
  __typename?: 'User';
  avatar?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastLoginAt?: Maybe<Scalars['DateTime']['output']>;
  lastName: Scalars['String']['output'];
  mfaEnabled: Scalars['Boolean']['output'];
  permissions: Array<Scalars['String']['output']>;
  tenants: Array<UserTenant>;
  updatedAt: Scalars['DateTime']['output'];
};

export type UserConnection = {
  __typename?: 'UserConnection';
  nodes: Array<User>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type UserFilter = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tenantId?: InputMaybe<Scalars['ID']['input']>;
};

export type UserStatusUpdate = {
  __typename?: 'UserStatusUpdate';
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type UserTenant = {
  __typename?: 'UserTenant';
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  role: Scalars['String']['output'];
};

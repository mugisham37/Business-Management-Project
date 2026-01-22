import { gql } from '@apollo/client';
import * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client';
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
const defaultOptions = {} as const;
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
  __typename: 'AuthResult';
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  tokens: Maybe<TokenPair>;
  user: Maybe<User>;
};

export type BrandingConfig = {
  __typename: 'BrandingConfig';
  favicon: Maybe<Scalars['String']['output']>;
  logo: Maybe<Scalars['String']['output']>;
  primaryColor: Maybe<Scalars['String']['output']>;
  secondaryColor: Maybe<Scalars['String']['output']>;
};

export enum BusinessTier {
  ENTERPRISE = 'ENTERPRISE',
  MEDIUM = 'MEDIUM',
  MICRO = 'MICRO',
  SMALL = 'SMALL',
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
  __typename: 'CreateUserResult';
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  user: Maybe<User>;
};

export type DeleteUserResult = MutationResponse & {
  __typename: 'DeleteUserResult';
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type FeatureFlag = {
  __typename: 'FeatureFlag';
  config: Maybe<Scalars['JSON']['output']>;
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
  __typename: 'Mutation';
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
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type PageInfo = {
  __typename: 'PageInfo';
  endCursor: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Maybe<Scalars['String']['output']>;
};

export type PaginationInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type Query = {
  __typename: 'Query';
  currentTenant: Maybe<Tenant>;
  currentUser: Maybe<User>;
  featureFlag: Maybe<FeatureFlag>;
  featureFlags: Array<FeatureFlag>;
  health: Scalars['String']['output'];
  tenant: Maybe<Tenant>;
  tenants: Array<Tenant>;
  user: Maybe<User>;
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
  __typename: 'Subscription';
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
  __typename: 'Tenant';
  branding: Maybe<BrandingConfig>;
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
  __typename: 'TenantLimits';
  maxApiCalls: Scalars['Int']['output'];
  maxIntegrations: Scalars['Int']['output'];
  maxStorage: Scalars['BigInt']['output'];
  maxUsers: Scalars['Int']['output'];
};

export type TenantSettings = {
  __typename: 'TenantSettings';
  currency: Scalars['String']['output'];
  dateFormat: Scalars['String']['output'];
  features: Scalars['JSON']['output'];
  language: Scalars['String']['output'];
  limits: TenantLimits;
  timezone: Scalars['String']['output'];
};

export type TenantUpdate = {
  __typename: 'TenantUpdate';
  data: Scalars['JSON']['output'];
  tenantId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  type: Scalars['String']['output'];
};

export type TokenPair = {
  __typename: 'TokenPair';
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
  __typename: 'UpdateUserResult';
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  user: Maybe<User>;
};

export type User = {
  __typename: 'User';
  avatar: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastLoginAt: Maybe<Scalars['DateTime']['output']>;
  lastName: Scalars['String']['output'];
  mfaEnabled: Scalars['Boolean']['output'];
  permissions: Array<Scalars['String']['output']>;
  tenants: Array<UserTenant>;
  updatedAt: Scalars['DateTime']['output'];
};

export type UserConnection = {
  __typename: 'UserConnection';
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
  __typename: 'UserStatusUpdate';
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type UserTenant = {
  __typename: 'UserTenant';
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  role: Scalars['String']['output'];
};

export type GetUsersForCacheTestQueryVariables = Exact<{ [key: string]: never }>;

export type GetUsersForCacheTestQuery = {
  __typename: 'Query';
  users: {
    __typename: 'UserConnection';
    nodes: Array<{
      __typename: 'User';
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    }>;
  };
};

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;

export type CreateUserMutation = {
  __typename: 'Mutation';
  createUser: {
    __typename: 'CreateUserResult';
    success: boolean;
    message: string | null;
    user: {
      __typename: 'User';
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  };
};

export type UpdateUserMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
}>;

export type UpdateUserMutation = {
  __typename: 'Mutation';
  updateUser: {
    __typename: 'UpdateUserResult';
    success: boolean;
    message: string | null;
    user: {
      __typename: 'User';
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  };
};

export type DeleteUserMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteUserMutation = {
  __typename: 'Mutation';
  deleteUser: { __typename: 'DeleteUserResult'; success: boolean; message: string | null };
};

export type GetExampleDataQueryVariables = Exact<{ [key: string]: never }>;

export type GetExampleDataQuery = {
  __typename: 'Query';
  currentUser: {
    __typename: 'User';
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;

export type LoginMutation = {
  __typename: 'Mutation';
  login: {
    __typename: 'AuthResult';
    success: boolean;
    message: string | null;
    user: {
      __typename: 'User';
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      permissions: Array<string>;
    } | null;
    tokens: {
      __typename: 'TokenPair';
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    } | null;
  };
};

export type RefreshTokenMutationVariables = Exact<{
  refreshToken: Scalars['String']['input'];
}>;

export type RefreshTokenMutation = {
  __typename: 'Mutation';
  refreshToken: {
    __typename: 'AuthResult';
    success: boolean;
    message: string | null;
    tokens: {
      __typename: 'TokenPair';
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    } | null;
  };
};

export type LogoutMutationVariables = Exact<{ [key: string]: never }>;

export type LogoutMutation = {
  __typename: 'Mutation';
  logout: { __typename: 'AuthResult'; success: boolean; message: string | null };
};

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetCurrentUserQuery = {
  __typename: 'Query';
  currentUser: {
    __typename: 'User';
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    permissions: Array<string>;
    createdAt: Date;
    updatedAt: Date;
    tenants: Array<{
      __typename: 'UserTenant';
      id: string;
      name: string;
      role: string;
      isActive: boolean;
    }>;
  } | null;
};

export type GetUsersQueryVariables = Exact<{
  filter?: InputMaybe<UserFilter>;
  pagination?: InputMaybe<PaginationInput>;
}>;

export type GetUsersQuery = {
  __typename: 'Query';
  users: {
    __typename: 'UserConnection';
    totalCount: number;
    nodes: Array<{
      __typename: 'User';
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
      createdAt: Date;
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

export const GetUsersForCacheTestDocument = gql`
  query GetUsersForCacheTest {
    users {
      nodes {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

/**
 * __useGetUsersForCacheTestQuery__
 *
 * To run a query within a React component, call `useGetUsersForCacheTestQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUsersForCacheTestQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUsersForCacheTestQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetUsersForCacheTestQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetUsersForCacheTestQuery,
    GetUsersForCacheTestQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetUsersForCacheTestQuery, GetUsersForCacheTestQueryVariables>(
    GetUsersForCacheTestDocument,
    options
  );
}
export function useGetUsersForCacheTestLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetUsersForCacheTestQuery,
    GetUsersForCacheTestQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetUsersForCacheTestQuery,
    GetUsersForCacheTestQueryVariables
  >(GetUsersForCacheTestDocument, options);
}
// @ts-ignore
export function useGetUsersForCacheTestSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetUsersForCacheTestQuery,
    GetUsersForCacheTestQueryVariables
  >
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUsersForCacheTestQuery,
  GetUsersForCacheTestQueryVariables
>;
export function useGetUsersForCacheTestSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUsersForCacheTestQuery,
        GetUsersForCacheTestQueryVariables
      >
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUsersForCacheTestQuery | undefined,
  GetUsersForCacheTestQueryVariables
>;
export function useGetUsersForCacheTestSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUsersForCacheTestQuery,
        GetUsersForCacheTestQueryVariables
      >
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetUsersForCacheTestQuery,
    GetUsersForCacheTestQueryVariables
  >(GetUsersForCacheTestDocument, options);
}
export type GetUsersForCacheTestQueryHookResult = ReturnType<typeof useGetUsersForCacheTestQuery>;
export type GetUsersForCacheTestLazyQueryHookResult = ReturnType<
  typeof useGetUsersForCacheTestLazyQuery
>;
export type GetUsersForCacheTestSuspenseQueryHookResult = ReturnType<
  typeof useGetUsersForCacheTestSuspenseQuery
>;
export type GetUsersForCacheTestQueryResult = ApolloReactCommon.QueryResult<
  GetUsersForCacheTestQuery,
  GetUsersForCacheTestQueryVariables
>;
export function refetchGetUsersForCacheTestQuery(variables?: GetUsersForCacheTestQueryVariables) {
  return { query: GetUsersForCacheTestDocument, variables: variables };
}
export const CreateUserDocument = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
      }
    }
  }
`;
export type CreateUserMutationFn = ApolloReactCommon.MutationFunction<
  CreateUserMutation,
  CreateUserMutationVariables
>;

/**
 * __useCreateUserMutation__
 *
 * To run a mutation, you first call `useCreateUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createUserMutation, { data, loading, error }] = useCreateUserMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateUserMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreateUserMutation,
    CreateUserMutationVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<CreateUserMutation, CreateUserMutationVariables>(
    CreateUserDocument,
    options
  );
}
export type CreateUserMutationHookResult = ReturnType<typeof useCreateUserMutation>;
export type CreateUserMutationResult = ApolloReactCommon.MutationResult<CreateUserMutation>;
export type CreateUserMutationOptions = ApolloReactCommon.BaseMutationOptions<
  CreateUserMutation,
  CreateUserMutationVariables
>;
export const UpdateUserDocument = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
      }
    }
  }
`;
export type UpdateUserMutationFn = ApolloReactCommon.MutationFunction<
  UpdateUserMutation,
  UpdateUserMutationVariables
>;

/**
 * __useUpdateUserMutation__
 *
 * To run a mutation, you first call `useUpdateUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateUserMutation, { data, loading, error }] = useUpdateUserMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateUserMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateUserMutation,
    UpdateUserMutationVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<UpdateUserMutation, UpdateUserMutationVariables>(
    UpdateUserDocument,
    options
  );
}
export type UpdateUserMutationHookResult = ReturnType<typeof useUpdateUserMutation>;
export type UpdateUserMutationResult = ApolloReactCommon.MutationResult<UpdateUserMutation>;
export type UpdateUserMutationOptions = ApolloReactCommon.BaseMutationOptions<
  UpdateUserMutation,
  UpdateUserMutationVariables
>;
export const DeleteUserDocument = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      message
    }
  }
`;
export type DeleteUserMutationFn = ApolloReactCommon.MutationFunction<
  DeleteUserMutation,
  DeleteUserMutationVariables
>;

/**
 * __useDeleteUserMutation__
 *
 * To run a mutation, you first call `useDeleteUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteUserMutation, { data, loading, error }] = useDeleteUserMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteUserMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeleteUserMutation,
    DeleteUserMutationVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<DeleteUserMutation, DeleteUserMutationVariables>(
    DeleteUserDocument,
    options
  );
}
export type DeleteUserMutationHookResult = ReturnType<typeof useDeleteUserMutation>;
export type DeleteUserMutationResult = ApolloReactCommon.MutationResult<DeleteUserMutation>;
export type DeleteUserMutationOptions = ApolloReactCommon.BaseMutationOptions<
  DeleteUserMutation,
  DeleteUserMutationVariables
>;
export const GetExampleDataDocument = gql`
  query GetExampleData {
    currentUser {
      id
      email
      firstName
      lastName
    }
  }
`;

/**
 * __useGetExampleDataQuery__
 *
 * To run a query within a React component, call `useGetExampleDataQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetExampleDataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetExampleDataQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetExampleDataQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<GetExampleDataQuery, GetExampleDataQueryVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetExampleDataQuery, GetExampleDataQueryVariables>(
    GetExampleDataDocument,
    options
  );
}
export function useGetExampleDataLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetExampleDataQuery,
    GetExampleDataQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetExampleDataQuery, GetExampleDataQueryVariables>(
    GetExampleDataDocument,
    options
  );
}
// @ts-ignore
export function useGetExampleDataSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetExampleDataQuery,
    GetExampleDataQueryVariables
  >
): ApolloReactHooks.UseSuspenseQueryResult<GetExampleDataQuery, GetExampleDataQueryVariables>;
export function useGetExampleDataSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetExampleDataQuery, GetExampleDataQueryVariables>
): ApolloReactHooks.UseSuspenseQueryResult<
  GetExampleDataQuery | undefined,
  GetExampleDataQueryVariables
>;
export function useGetExampleDataSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetExampleDataQuery, GetExampleDataQueryVariables>
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetExampleDataQuery, GetExampleDataQueryVariables>(
    GetExampleDataDocument,
    options
  );
}
export type GetExampleDataQueryHookResult = ReturnType<typeof useGetExampleDataQuery>;
export type GetExampleDataLazyQueryHookResult = ReturnType<typeof useGetExampleDataLazyQuery>;
export type GetExampleDataSuspenseQueryHookResult = ReturnType<
  typeof useGetExampleDataSuspenseQuery
>;
export type GetExampleDataQueryResult = ApolloReactCommon.QueryResult<
  GetExampleDataQuery,
  GetExampleDataQueryVariables
>;
export function refetchGetExampleDataQuery(variables?: GetExampleDataQueryVariables) {
  return { query: GetExampleDataDocument, variables: variables };
}
export const LoginDocument = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      message
      user {
        id
        email
        firstName
        lastName
        permissions
      }
      tokens {
        accessToken
        refreshToken
        expiresAt
      }
    }
  }
`;
export type LoginMutationFn = ApolloReactCommon.MutationFunction<
  LoginMutation,
  LoginMutationVariables
>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useLoginMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<LoginMutation, LoginMutationVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<LoginMutation, LoginMutationVariables>(
    LoginDocument,
    options
  );
}
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = ApolloReactCommon.MutationResult<LoginMutation>;
export type LoginMutationOptions = ApolloReactCommon.BaseMutationOptions<
  LoginMutation,
  LoginMutationVariables
>;
export const RefreshTokenDocument = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      success
      message
      tokens {
        accessToken
        refreshToken
        expiresAt
      }
    }
  }
`;
export type RefreshTokenMutationFn = ApolloReactCommon.MutationFunction<
  RefreshTokenMutation,
  RefreshTokenMutationVariables
>;

/**
 * __useRefreshTokenMutation__
 *
 * To run a mutation, you first call `useRefreshTokenMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRefreshTokenMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [refreshTokenMutation, { data, loading, error }] = useRefreshTokenMutation({
 *   variables: {
 *      refreshToken: // value for 'refreshToken'
 *   },
 * });
 */
export function useRefreshTokenMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RefreshTokenMutation,
    RefreshTokenMutationVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<RefreshTokenMutation, RefreshTokenMutationVariables>(
    RefreshTokenDocument,
    options
  );
}
export type RefreshTokenMutationHookResult = ReturnType<typeof useRefreshTokenMutation>;
export type RefreshTokenMutationResult = ApolloReactCommon.MutationResult<RefreshTokenMutation>;
export type RefreshTokenMutationOptions = ApolloReactCommon.BaseMutationOptions<
  RefreshTokenMutation,
  RefreshTokenMutationVariables
>;
export const LogoutDocument = gql`
  mutation Logout {
    logout {
      success
      message
    }
  }
`;
export type LogoutMutationFn = ApolloReactCommon.MutationFunction<
  LogoutMutation,
  LogoutMutationVariables
>;

/**
 * __useLogoutMutation__
 *
 * To run a mutation, you first call `useLogoutMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLogoutMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [logoutMutation, { data, loading, error }] = useLogoutMutation({
 *   variables: {
 *   },
 * });
 */
export function useLogoutMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<LogoutMutation, LogoutMutationVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<LogoutMutation, LogoutMutationVariables>(
    LogoutDocument,
    options
  );
}
export type LogoutMutationHookResult = ReturnType<typeof useLogoutMutation>;
export type LogoutMutationResult = ApolloReactCommon.MutationResult<LogoutMutation>;
export type LogoutMutationOptions = ApolloReactCommon.BaseMutationOptions<
  LogoutMutation,
  LogoutMutationVariables
>;
export const GetCurrentUserDocument = gql`
  query GetCurrentUser {
    currentUser {
      id
      email
      firstName
      lastName
      avatar
      permissions
      tenants {
        id
        name
        role
        isActive
      }
      createdAt
      updatedAt
    }
  }
`;

/**
 * __useGetCurrentUserQuery__
 *
 * To run a query within a React component, call `useGetCurrentUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCurrentUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCurrentUserQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCurrentUserQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
export function useGetCurrentUserLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetCurrentUserQuery,
    GetCurrentUserQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
// @ts-ignore
export function useGetCurrentUserSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetCurrentUserQuery,
    GetCurrentUserQueryVariables
  >
): ApolloReactHooks.UseSuspenseQueryResult<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export function useGetCurrentUserSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>
): ApolloReactHooks.UseSuspenseQueryResult<
  GetCurrentUserQuery | undefined,
  GetCurrentUserQueryVariables
>;
export function useGetCurrentUserSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
export type GetCurrentUserQueryHookResult = ReturnType<typeof useGetCurrentUserQuery>;
export type GetCurrentUserLazyQueryHookResult = ReturnType<typeof useGetCurrentUserLazyQuery>;
export type GetCurrentUserSuspenseQueryHookResult = ReturnType<
  typeof useGetCurrentUserSuspenseQuery
>;
export type GetCurrentUserQueryResult = ApolloReactCommon.QueryResult<
  GetCurrentUserQuery,
  GetCurrentUserQueryVariables
>;
export function refetchGetCurrentUserQuery(variables?: GetCurrentUserQueryVariables) {
  return { query: GetCurrentUserDocument, variables: variables };
}
export const GetUsersDocument = gql`
  query GetUsers($filter: UserFilter, $pagination: PaginationInput) {
    users(filter: $filter, pagination: $pagination) {
      nodes {
        id
        email
        firstName
        lastName
        avatar
        createdAt
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

/**
 * __useGetUsersQuery__
 *
 * To run a query within a React component, call `useGetUsersQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUsersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUsersQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *      pagination: // value for 'pagination'
 *   },
 * });
 */
export function useGetUsersQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<GetUsersQuery, GetUsersQueryVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetUsersQuery, GetUsersQueryVariables>(
    GetUsersDocument,
    options
  );
}
export function useGetUsersLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetUsersQuery, GetUsersQueryVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetUsersQuery, GetUsersQueryVariables>(
    GetUsersDocument,
    options
  );
}
// @ts-ignore
export function useGetUsersSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetUsersQuery, GetUsersQueryVariables>
): ApolloReactHooks.UseSuspenseQueryResult<GetUsersQuery, GetUsersQueryVariables>;
export function useGetUsersSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetUsersQuery, GetUsersQueryVariables>
): ApolloReactHooks.UseSuspenseQueryResult<GetUsersQuery | undefined, GetUsersQueryVariables>;
export function useGetUsersSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetUsersQuery, GetUsersQueryVariables>
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetUsersQuery, GetUsersQueryVariables>(
    GetUsersDocument,
    options
  );
}
export type GetUsersQueryHookResult = ReturnType<typeof useGetUsersQuery>;
export type GetUsersLazyQueryHookResult = ReturnType<typeof useGetUsersLazyQuery>;
export type GetUsersSuspenseQueryHookResult = ReturnType<typeof useGetUsersSuspenseQuery>;
export type GetUsersQueryResult = ApolloReactCommon.QueryResult<
  GetUsersQuery,
  GetUsersQueryVariables
>;
export function refetchGetUsersQuery(variables?: GetUsersQueryVariables) {
  return { query: GetUsersDocument, variables: variables };
}

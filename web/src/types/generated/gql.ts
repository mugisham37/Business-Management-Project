/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  '\n  query GetUsersForCacheTest {\n    users {\n      nodes {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n': typeof types.GetUsersForCacheTestDocument;
  '\n  mutation CreateUser($input: CreateUserInput!) {\n    createUser(input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n': typeof types.CreateUserDocument;
  '\n  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n': typeof types.UpdateUserDocument;
  '\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      success\n      message\n    }\n  }\n': typeof types.DeleteUserDocument;
  '\n  query GetExampleData {\n    currentUser {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n': typeof types.GetExampleDataDocument;
  'mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    success\n    message\n    user {\n      id\n      email\n      firstName\n      lastName\n      permissions\n    }\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation RefreshToken($refreshToken: String!) {\n  refreshToken(refreshToken: $refreshToken) {\n    success\n    message\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation Logout {\n  logout {\n    success\n    message\n  }\n}': typeof types.LoginDocument;
  'query GetCurrentUser {\n  currentUser {\n    id\n    email\n    firstName\n    lastName\n    avatar\n    permissions\n    tenants {\n      id\n      name\n      role\n      isActive\n    }\n    createdAt\n    updatedAt\n  }\n}\n\nquery GetUsers($filter: UserFilter, $pagination: PaginationInput) {\n  users(filter: $filter, pagination: $pagination) {\n    nodes {\n      id\n      email\n      firstName\n      lastName\n      avatar\n      createdAt\n    }\n    totalCount\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}': typeof types.GetCurrentUserDocument;
};
const documents: Documents = {
  '\n  query GetUsersForCacheTest {\n    users {\n      nodes {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n':
    types.GetUsersForCacheTestDocument,
  '\n  mutation CreateUser($input: CreateUserInput!) {\n    createUser(input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n':
    types.CreateUserDocument,
  '\n  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n':
    types.UpdateUserDocument,
  '\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      success\n      message\n    }\n  }\n':
    types.DeleteUserDocument,
  '\n  query GetExampleData {\n    currentUser {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n':
    types.GetExampleDataDocument,
  'mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    success\n    message\n    user {\n      id\n      email\n      firstName\n      lastName\n      permissions\n    }\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation RefreshToken($refreshToken: String!) {\n  refreshToken(refreshToken: $refreshToken) {\n    success\n    message\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation Logout {\n  logout {\n    success\n    message\n  }\n}':
    types.LoginDocument,
  'query GetCurrentUser {\n  currentUser {\n    id\n    email\n    firstName\n    lastName\n    avatar\n    permissions\n    tenants {\n      id\n      name\n      role\n      isActive\n    }\n    createdAt\n    updatedAt\n  }\n}\n\nquery GetUsers($filter: UserFilter, $pagination: PaginationInput) {\n  users(filter: $filter, pagination: $pagination) {\n    nodes {\n      id\n      email\n      firstName\n      lastName\n      avatar\n      createdAt\n    }\n    totalCount\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}':
    types.GetCurrentUserDocument,
};

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = gql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function gql(source: string): unknown;

/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: '\n  query GetUsersForCacheTest {\n    users {\n      nodes {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n'
): (typeof documents)['\n  query GetUsersForCacheTest {\n    users {\n      nodes {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n'];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: '\n  mutation CreateUser($input: CreateUserInput!) {\n    createUser(input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n'
): (typeof documents)['\n  mutation CreateUser($input: CreateUserInput!) {\n    createUser(input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n'];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: '\n  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n'
): (typeof documents)['\n  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {\n    updateUser(id: $id, input: $input) {\n      success\n      message\n      user {\n        id\n        firstName\n        lastName\n        email\n      }\n    }\n  }\n'];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: '\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      success\n      message\n    }\n  }\n'
): (typeof documents)['\n  mutation DeleteUser($id: ID!) {\n    deleteUser(id: $id) {\n      success\n      message\n    }\n  }\n'];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: '\n  query GetExampleData {\n    currentUser {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n'
): (typeof documents)['\n  query GetExampleData {\n    currentUser {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n'];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: 'mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    success\n    message\n    user {\n      id\n      email\n      firstName\n      lastName\n      permissions\n    }\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation RefreshToken($refreshToken: String!) {\n  refreshToken(refreshToken: $refreshToken) {\n    success\n    message\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation Logout {\n  logout {\n    success\n    message\n  }\n}'
): (typeof documents)['mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    success\n    message\n    user {\n      id\n      email\n      firstName\n      lastName\n      permissions\n    }\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation RefreshToken($refreshToken: String!) {\n  refreshToken(refreshToken: $refreshToken) {\n    success\n    message\n    tokens {\n      accessToken\n      refreshToken\n      expiresAt\n    }\n  }\n}\n\nmutation Logout {\n  logout {\n    success\n    message\n  }\n}'];
/**
 * The gql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function gql(
  source: 'query GetCurrentUser {\n  currentUser {\n    id\n    email\n    firstName\n    lastName\n    avatar\n    permissions\n    tenants {\n      id\n      name\n      role\n      isActive\n    }\n    createdAt\n    updatedAt\n  }\n}\n\nquery GetUsers($filter: UserFilter, $pagination: PaginationInput) {\n  users(filter: $filter, pagination: $pagination) {\n    nodes {\n      id\n      email\n      firstName\n      lastName\n      avatar\n      createdAt\n    }\n    totalCount\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}'
): (typeof documents)['query GetCurrentUser {\n  currentUser {\n    id\n    email\n    firstName\n    lastName\n    avatar\n    permissions\n    tenants {\n      id\n      name\n      role\n      isActive\n    }\n    createdAt\n    updatedAt\n  }\n}\n\nquery GetUsers($filter: UserFilter, $pagination: PaginationInput) {\n  users(filter: $filter, pagination: $pagination) {\n    nodes {\n      id\n      email\n      firstName\n      lastName\n      avatar\n      createdAt\n    }\n    totalCount\n    pageInfo {\n      hasNextPage\n      hasPreviousPage\n      startCursor\n      endCursor\n    }\n  }\n}'];

export function gql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;

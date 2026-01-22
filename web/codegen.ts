// import type { CodegenConfig } from '@graphql-codegen/cli';

const config = {
  schema: process.env.NEXT_PUBLIC_GRAPHQL_URI || 'http://localhost:4000/graphql',
  documents: ['src/**/*.{ts,tsx,graphql,gql}'],
  generates: {
    './src/types/generated/': {
      preset: 'client',
      plugins: [],
      presetConfig: {
        gqlTagName: 'gql',
      },
    },
    './src/types/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        withHooks: true,
        withHOC: false,
        withComponent: false,
        apolloReactHooksImportFrom: '@apollo/client',
        apolloReactCommonImportFrom: '@apollo/client',
        skipTypename: false,
        withRefetchFn: true,
        scalars: {
          DateTime: 'Date',
          JSON: 'Record<string, any>',
          Upload: 'File',
        },
      },
    },
    './src/types/generated/introspection.json': {
      plugins: ['introspection'],
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
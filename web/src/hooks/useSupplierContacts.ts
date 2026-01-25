import { useQuery, useMutation } from '@apollo/client';
import { useCallback } from 'react';
import { gql } from '@apollo/client';
import {
  GET_SUPPLIER_CONTACT,
  GET_SUPPLIER_CONTACTS,
  GET_PRIMARY_SUPPLIER_CONTACT,
} from '@/graphql/queries/supplier';
import {
  CREATE_SUPPLIER_CONTACT,
  UPDATE_SUPPLIER_CONTACT,
  DELETE_SUPPLIER_CONTACT,
  SET_PRIMARY_CONTACT,
} from '@/graphql/mutations/supplier';
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from './useGraphQLMutations';
import type {
  SupplierContact,
  CreateSupplierContactInput,
  UpdateSupplierContactInput,
} from '@/types/supplier';

// Hook for fetching supplier contacts
export function useSupplierContacts(supplierId: string) {
  const { data, loading, error, refetch } = useQuery<{
    supplierContacts: SupplierContact[];
  }>(GET_SUPPLIER_CONTACTS, {
    variables: { supplierId },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  return {
    contacts: data?.supplierContacts || [],
    loading,
    error,
    refetch,
  };
}

// Hook for fetching a single supplier contact
export function useSupplierContact(id: string) {
  const { data, loading, error, refetch } = useQuery<{
    supplierContact: SupplierContact;
  }>(GET_SUPPLIER_CONTACT, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  return {
    contact: data?.supplierContact,
    loading,
    error,
    refetch,
  };
}

// Hook for fetching primary supplier contact
export function usePrimarySupplierContact(supplierId: string) {
  const { data, loading, error } = useQuery<{
    primarySupplierContact: SupplierContact;
  }>(GET_PRIMARY_SUPPLIER_CONTACT, {
    variables: { supplierId },
    skip: !supplierId,
    errorPolicy: 'all',
  });

  return {
    primaryContact: data?.primarySupplierContact,
    loading,
    error,
  };
}

// Hook for creating supplier contacts
export function useCreateSupplierContact() {
  const [createContact, { loading, error }] = useCreateMutation(
    CREATE_SUPPLIER_CONTACT,
    GET_SUPPLIER_CONTACTS,
    'supplierContacts',
    (variables: Record<string, unknown>) => {
      const input = variables.input as CreateSupplierContactInput;
      const supplierId = variables.supplierId as string;
      return {
        id: `temp-${Date.now()}`,
        supplierId,
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  );

  const create = useCallback(
    async (supplierId: string, input: CreateSupplierContactInput) => {
      return createContact({ supplierId, input });
    },
    [createContact]
  );

  return { createContact: create, loading, error };
}

// Hook for updating supplier contacts
export function useUpdateSupplierContact() {
  const [updateContact, { loading, error }] = useUpdateMutation(
    UPDATE_SUPPLIER_CONTACT,
    GET_SUPPLIER_CONTACTS,
    'supplierContacts'
  );

  const update = useCallback(
    async (id: string, input: UpdateSupplierContactInput) => {
      return updateContact({ id, input });
    },
    [updateContact]
  );

  return { updateContact: update, loading, error };
}

// Hook for deleting supplier contacts
export function useDeleteSupplierContact() {
  const [deleteContact, { loading, error }] = useDeleteMutation(
    DELETE_SUPPLIER_CONTACT,
    GET_SUPPLIER_CONTACTS,
    'supplierContacts'
  );

  const remove = useCallback(
    async (id: string) => {
      return deleteContact({ id });
    },
    [deleteContact]
  );

  return { deleteContact: remove, loading, error };
}

// Hook for setting primary contact
export function useSetPrimaryContact() {
  const [setPrimary, { loading, error }] = useMutation(SET_PRIMARY_CONTACT, {
    errorPolicy: 'all',
    update: (cache, { data }, mutationResult) => {
      if (!data?.setPrimaryContact) return;
      
      const variables = mutationResult.variables as Record<string, unknown> | undefined;
      if (!variables?.id) return;

      // Update all contacts for this supplier to set isPrimary correctly
      cache.modify({
        fields: {
          supplierContacts(existingContacts: unknown[] = [], { readField }) {
            return (existingContacts as unknown[]).map((contactRef: unknown) => {
              const id = readField('id', contactRef);
              const contactId = variables.id as string;
              const cacheId = cache.identify(contactRef as Record<string, unknown>);
              
              if (id === contactId && cacheId) {
                // This is the new primary contact
                return cache.writeFragment({
                  id: cacheId,
                  fragment: gql`
                    fragment UpdatedContact on SupplierContact {
                      isPrimary
                    }
                  `,
                  data: { isPrimary: true },
                });
              } else if (cacheId) {
                // All other contacts should not be primary
                return cache.writeFragment({
                  id: cacheId,
                  fragment: gql`
                    fragment UpdatedContact on SupplierContact {
                      isPrimary
                    }
                  `,
                  data: { isPrimary: false },
                });
              }
              return contactRef;
            });
          },
        },
      });
    },
  });

  const setPrimaryContact = useCallback(
    async (id: string) => {
      return setPrimary({ variables: { id } });
    },
    [setPrimary]
  );

  return { setPrimaryContact, loading, error };
}

// Comprehensive supplier contact management hook
export function useSupplierContactManagement(supplierId: string) {
  const { contacts, loading: fetchingContacts, refetch } = useSupplierContacts(supplierId);
  const { primaryContact } = usePrimarySupplierContact(supplierId);
  const { createContact, loading: creating } = useCreateSupplierContact();
  const { updateContact, loading: updating } = useUpdateSupplierContact();
  const { deleteContact, loading: deleting } = useDeleteSupplierContact();
  const { setPrimaryContact, loading: settingPrimary } = useSetPrimaryContact();

  const isLoading = fetchingContacts || creating || updating || deleting || settingPrimary;

  const actions = {
    create: createContact,
    update: updateContact,
    delete: deleteContact,
    setPrimary: setPrimaryContact,
    refresh: refetch,
  };

  return {
    contacts,
    primaryContact,
    actions,
    isLoading,
  };
}
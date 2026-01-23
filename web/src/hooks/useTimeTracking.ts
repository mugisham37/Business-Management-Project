/**
 * Time Tracking Hooks
 * Complete hooks for time tracking and scheduling
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  GET_EMPLOYEE_SCHEDULES, 
  GET_TIME_ENTRIES 
} from '@/graphql/queries/employee';
import { 
  CREATE_EMPLOYEE_SCHEDULE, 
  UPDATE_EMPLOYEE_SCHEDULE,
  CLOCK_IN, 
  CLOCK_OUT, 
  APPROVE_TIME_ENTRY 
} from '@/graphql/mutations/employee';
import { 
  EMPLOYEE_CLOCKED_IN, 
  EMPLOYEE_CLOCKED_OUT, 
  TIME_ENTRY_APPROVED,
  EMPLOYEE_SCHEDULE_CREATED,
  EMPLOYEE_SCHEDULE_UPDATED
} from '@/graphql/subscriptions/employee';
import { useCreateMutation, useUpdateMutation } from './useGraphQLMutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { 
  EmployeeSchedule, 
  TimeEntry, 
  TimeEntryQueryInput,
  ClockInInput,
  ClockOutInput
} from '@/types/employee';

/**
 * Hook for managing employee schedules
 */
export function useEmployeeSchedules(employeeId?: string, startDate?: Date, endDate?: Date) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  // Query schedules
  const { data, loading, error, refetch } = useQuery<{
    employeeSchedules: EmployeeSchedule[];
  }>(GET_EMPLOYEE_SCHEDULES, {
    variables: { 
      employeeId: employeeId!, 
      startDate, 
      endDate 
    },
    skip: !employeeId || !currentTenant?.id,
    errorPolicy: 'all',
  });

  // Create schedule mutation
  const [createScheduleMutation, { loading: creating }] = useCreateMutation(
    CREATE_EMPLOYEE_SCHEDULE,
    GET_EMPLOYEE_SCHEDULES,
    'employeeSchedules'
  );

  // Update schedule mutation
  const [updateScheduleMutation, { loading: updating }] = useUpdateMutation(
    UPDATE_EMPLOYEE_SCHEDULE,
    GET_EMPLOYEE_SCHEDULES,
    'employeeSchedules'
  );

  // Real-time subscriptions
  useSubscription(EMPLOYEE_SCHEDULE_CREATED, {
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.employeeScheduleCreated) {
        console.log('Schedule created:', subscriptionData.data.employeeScheduleCreated);
      }
    },
  });

  useSubscription(EMPLOYEE_SCHEDULE_UPDATED, {
    onData: ({ data: subscriptionData }) => {
      if (subscriptionData?.data?.employeeScheduleUpdated) {
        console.log('Schedule updated:', subscriptionData.data.employeeScheduleUpdated);
      }
    },
  });

  // Actions
  const createSchedule = useCallback(async (input: any) => {
    try {
      const result = await createScheduleMutation({ variables: { input } });
      return result.data?.createEmployeeSchedule;
    } catch (error) {
      console.error('Failed to create schedule:', error);
      throw error;
    }
  }, [createScheduleMutation]);

  const updateSchedule = useCallback(async (id: string, input: any) => {
    try {
      const result = await updateScheduleMutation({ variables: { id, input } });
      return result.data?.updateEmployeeSchedule;
    } catch (error) {
      console.error('Failed to update schedule:', error);
      throw error;
    }
  }, [updateScheduleMutation]);

  // Computed values
  const schedules = useMemo(() => data?.employeeSchedules || [], [data]);

  return {
    // Data
    schedules,
    
    // Loading states
    loading,
    creating,
    updating,
    
    // Error state
    error,
    
    // Actions
    createSchedule,
    updateSchedule,
    refetch,
  };
}

/**
 * Hook for managing time entries
 */
export function us
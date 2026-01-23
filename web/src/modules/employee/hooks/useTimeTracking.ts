/**
 * Time Tracking Hook
 * Comprehensive hook for employee time tracking and schedule management
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useCreateMutation, useUpdateMutation } from '@/hooks/useGraphQLMutations';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { errorLogger } from '@/lib/error-handling';

// GraphQL Operations
import {
  GET_TIME_ENTRIES,
  GET_EMPLOYEE_SCHEDULES,
} from '@/graphql/queries/employee';

import {
  CLOCK_IN,
  CLOCK_OUT,
  APPROVE_TIME_ENTRY,
  CREATE_TIME_ENTRY,
  UPDATE_TIME_ENTRY,
  CREATE_EMPLOYEE_SCHEDULE,
  UPDATE_EMPLOYEE_SCHEDULE,
} from '@/graphql/mutations/employee';

import {
  EMPLOYEE_CLOCKED_IN_SUBSCRIPTION,
  EMPLOYEE_CLOCKED_OUT_SUBSCRIPTION,
  TIME_ENTRY_APPROVED_SUBSCRIPTION,
  EMPLOYEE_SCHEDULE_CREATED_SUBSCRIPTION,
  EMPLOYEE_SCHEDULE_UPDATED_SUBSCRIPTION,
} from '@/graphql/subscriptions/employee';

// Types
import {
  TimeEntry,
  EmployeeSchedule,
  TimeEntryQueryInput,
  TimeEntryFormData,
  TimeEntryType,
  ScheduleStatus,
} from '@/types/employee';

interface UseTimeTrackingOptions {
  employeeId?: string;
  enableSubscriptions?: boolean;
  enableRealTimeUpdates?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface ClockInInput {
  employeeId: string;
  locationId?: string;
  notes?: string;
}

interface ClockOutInput {
  timeEntryId: string;
  notes?: string;
}

interface CreateScheduleInput {
  employeeId: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  breakDuration?: number;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  scheduleType?: string;
  status?: ScheduleStatus;
  locationId?: string;
  department?: string;
  notes?: string;
}

interface UseTimeTrackingReturn {
  // Data
  timeEntries: TimeEntry[];
  schedules: EmployeeSchedule[];
  currentTimeEntry: TimeEntry | null;
  todaySchedule: EmployeeSchedule | null;
  
  // Loading states
  timeEntriesLoading: boolean;
  schedulesLoading: boolean;
  clockingLoading: boolean;
  
  // Error states
  error: Error | null;
  
  // Time tracking operations
  clockIn: (input: ClockInInput) => Promise<TimeEntry>;
  clockOut: (input: ClockOutInput) => Promise<TimeEntry>;
  createTimeEntry: (input: TimeEntryFormData) => Promise<TimeEntry>;
  updateTimeEntry: (id: string, input: Partial<TimeEntryFormData>) => Promise<TimeEntry>;
  approveTimeEntry: (timeEntryId: string) => Promise<TimeEntry>;
  
  // Schedule operations
  createSchedule: (input: CreateScheduleInput) => Promise<EmployeeSchedule>;
  updateSchedule: (id: string, input: Partial<CreateScheduleInput>) => Promise<EmployeeSchedule>;
  
  // Data fetching
  refetchTimeEntries: () => Promise<void>;
  refetchSchedules: () => Promise<void>;
  
  // Filtering
  setTimeEntryFilters: (filters: TimeEntryQueryInput) => void;
  setDateRange: (startDate: Date, endDate: Date) => void;
  
  // Utilities
  isCurrentlyWorking: (employeeId?: string) => boolean;
  getTotalHoursForPeriod: (startDate: Date, endDate: Date, employeeId?: string) => number;
  getOvertimeHours: (startDate: Date, endDate: Date, employeeId?: string) => number;
  getAttendanceRate: (startDate: Date, endDate: Date, employeeId?: string) => number;
  getCurrentStatus: (employeeId?: string) => 'clocked_in' | 'clocked_out' | 'on_break' | 'unknown';
  
  // Analytics
  getTimeAnalytics: (startDate: Date, endDate: Date, employeeId?: string) => TimeAnalytics;
  getScheduleCompliance: (startDate: Date, endDate: Date, employeeId?: string) => ScheduleCompliance;
}

interface TimeAnalytics {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  breakTime: number;
  averageHoursPerDay: number;
  daysWorked: number;
  attendanceRate: number;
  punctualityRate: number;
}

interface ScheduleCompliance {
  scheduledHours: number;
  actualHours: number;
  complianceRate: number;
  lateArrivals: number;
  earlyDepartures: number;
  missedShifts: number;
}

export function useTimeTracking(options: UseTimeTrackingOptions = {}): UseTimeTrackingReturn {
  const {
    employeeId,
    enableSubscriptions = true,
    enableRealTimeUpdates = true,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;
  
  const currentTenant = useTenantStore(state => state.currentTenant);
  const [timeEntryQuery, setTimeEntryQuery] = useState<TimeEntryQueryInput>({
    employeeId,
    page: 1,
    limit: 50,
  });
  const [clockingLoading, setClocingLoading] = useState(false);

  // Time entries query
  const {
    data: timeEntriesData,
    loading: timeEntriesLoading,
    error,
    refetch: refetchTimeEntries,
  } = useQuery(GET_TIME_ENTRIES, {
    variables: { query: timeEntryQuery },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    pollInterval: autoRefresh ? refreshInterval : 0,
  });

  // Schedules query
  const {
    data: schedulesData,
    loading: schedulesLoading,
    refetch: refetchSchedules,
  } = useQuery(GET_EMPLOYEE_SCHEDULES, {
    variables: {
      employeeId: employeeId || '',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
    },
    skip: !currentTenant?.id || !employeeId,
    errorPolicy: 'all',
  });

  // Mutations
  const [clockInMutation] = useMutation(CLOCK_IN);
  const [clockOutMutation] = useMutation(CLOCK_OUT);
  const [approveTimeEntryMutation] = useMutation(APPROVE_TIME_ENTRY);
  
  const [createTimeEntryMutation] = useCreateMutation(
    CREATE_TIME_ENTRY,
    GET_TIME_ENTRIES,
    'timeEntries'
  );
  
  const [updateTimeEntryMutation] = useUpdateMutation(
    UPDATE_TIME_ENTRY,
    GET_TIME_ENTRIES,
    'timeEntries'
  );
  
  const [createScheduleMutation] = useCreateMutation(
    CREATE_EMPLOYEE_SCHEDULE,
    GET_EMPLOYEE_SCHEDULES,
    'employeeSchedules'
  );
  
  const [updateScheduleMutation] = useUpdateMutation(
    UPDATE_EMPLOYEE_SCHEDULE,
    GET_EMPLOYEE_SCHEDULES,
    'employeeSchedules'
  );

  // Subscriptions
  useSubscription(EMPLOYEE_CLOCKED_IN_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeClockedIn && enableRealTimeUpdates) {
        refetchTimeEntries();
      }
    },
  });

  useSubscription(EMPLOYEE_CLOCKED_OUT_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeClockedOut && enableRealTimeUpdates) {
        refetchTimeEntries();
      }
    },
  });

  useSubscription(TIME_ENTRY_APPROVED_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.timeEntryApproved && enableRealTimeUpdates) {
        refetchTimeEntries();
      }
    },
  });

  useSubscription(EMPLOYEE_SCHEDULE_CREATED_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeScheduleCreated && enableRealTimeUpdates) {
        refetchSchedules();
      }
    },
  });

  useSubscription(EMPLOYEE_SCHEDULE_UPDATED_SUBSCRIPTION, {
    skip: !enableSubscriptions || !currentTenant?.id,
    onData: ({ data }) => {
      if (data?.data?.employeeScheduleUpdated && enableRealTimeUpdates) {
        refetchSchedules();
      }
    },
  });

  // Computed values
  const timeEntries = useMemo(() => {
    return timeEntriesData?.timeEntries || [];
  }, [timeEntriesData]);

  const schedules = useMemo(() => {
    return schedulesData?.employeeSchedules || [];
  }, [schedulesData]);

  const currentTimeEntry = useMemo(() => {
    return timeEntries.find(entry => !entry.clockOutTime) || null;
  }, [timeEntries]);

  const todaySchedule = useMemo(() => {
    const today = new Date().toDateString();
    return schedules.find(schedule => 
      new Date(schedule.scheduleDate).toDateString() === today
    ) || null;
  }, [schedules]);

  // Time tracking operations
  const clockIn = useCallback(async (input: ClockInInput): Promise<TimeEntry> => {
    setClocingLoading(true);
    try {
      const result = await clockInMutation({
        variables: { input },
      });
      return result.data?.clockIn;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'clockIn',
      });
      throw error;
    } finally {
      setClocingLoading(false);
    }
  }, [clockInMutation]);

  const clockOut = useCallback(async (input: ClockOutInput): Promise<TimeEntry> => {
    setClocingLoading(true);
    try {
      const result = await clockOutMutation({
        variables: { input },
      });
      return result.data?.clockOut;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'clockOut',
      });
      throw error;
    } finally {
      setClocingLoading(false);
    }
  }, [clockOutMutation]);

  const createTimeEntry = useCallback(async (input: TimeEntryFormData): Promise<TimeEntry> => {
    try {
      const result = await createTimeEntryMutation({ input });
      return result.data?.createTimeEntry;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'createTimeEntry',
      });
      throw error;
    }
  }, [createTimeEntryMutation]);

  const updateTimeEntry = useCallback(async (
    id: string,
    input: Partial<TimeEntryFormData>
  ): Promise<TimeEntry> => {
    try {
      const result = await updateTimeEntryMutation({ id, input });
      return result.data?.updateTimeEntry;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'updateTimeEntry',
      });
      throw error;
    }
  }, [updateTimeEntryMutation]);

  const approveTimeEntry = useCallback(async (timeEntryId: string): Promise<TimeEntry> => {
    try {
      const result = await approveTimeEntryMutation({
        variables: { timeEntryId },
      });
      return result.data?.approveTimeEntry;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'approveTimeEntry',
      });
      throw error;
    }
  }, [approveTimeEntryMutation]);

  // Schedule operations
  const createSchedule = useCallback(async (input: CreateScheduleInput): Promise<EmployeeSchedule> => {
    try {
      const result = await createScheduleMutation({ input });
      return result.data?.createEmployeeSchedule;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'createSchedule',
      });
      throw error;
    }
  }, [createScheduleMutation]);

  const updateSchedule = useCallback(async (
    id: string,
    input: Partial<CreateScheduleInput>
  ): Promise<EmployeeSchedule> => {
    try {
      const result = await updateScheduleMutation({ id, input });
      return result.data?.updateEmployeeSchedule;
    } catch (error) {
      errorLogger.logError(error as Error, {
        component: 'useTimeTracking',
        operation: 'updateSchedule',
      });
      throw error;
    }
  }, [updateScheduleMutation]);

  // Filtering
  const setTimeEntryFilters = useCallback((filters: TimeEntryQueryInput) => {
    setTimeEntryQuery(prev => ({ ...prev, ...filters, page: 1 }));
  }, []);

  const setDateRange = useCallback((startDate: Date, endDate: Date) => {
    setTimeEntryQuery(prev => ({
      ...prev,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      page: 1,
    }));
  }, []);

  // Utilities
  const isCurrentlyWorking = useCallback((empId?: string): boolean => {
    const targetEmployeeId = empId || employeeId;
    if (!targetEmployeeId) return false;
    
    return timeEntries.some(entry => 
      entry.employeeId === targetEmployeeId && !entry.clockOutTime
    );
  }, [timeEntries, employeeId]);

  const getTotalHoursForPeriod = useCallback((
    startDate: Date,
    endDate: Date,
    empId?: string
  ): number => {
    const targetEmployeeId = empId || employeeId;
    
    return timeEntries
      .filter(entry => {
        const entryDate = new Date(entry.clockInTime);
        const matchesEmployee = !targetEmployeeId || entry.employeeId === targetEmployeeId;
        const inDateRange = entryDate >= startDate && entryDate <= endDate;
        return matchesEmployee && inDateRange;
      })
      .reduce((total, entry) => total + (entry.totalHours || 0), 0);
  }, [timeEntries, employeeId]);

  const getOvertimeHours = useCallback((
    startDate: Date,
    endDate: Date,
    empId?: string
  ): number => {
    const targetEmployeeId = empId || employeeId;
    
    return timeEntries
      .filter(entry => {
        const entryDate = new Date(entry.clockInTime);
        const matchesEmployee = !targetEmployeeId || entry.employeeId === targetEmployeeId;
        const inDateRange = entryDate >= startDate && entryDate <= endDate;
        return matchesEmployee && inDateRange;
      })
      .reduce((total, entry) => total + (entry.overtimeHours || 0), 0);
  }, [timeEntries, employeeId]);

  const getAttendanceRate = useCallback((
    startDate: Date,
    endDate: Date,
    empId?: string
  ): number => {
    const targetEmployeeId = empId || employeeId;
    if (!targetEmployeeId) return 0;
    
    const scheduledDays = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.scheduleDate);
      return schedule.employeeId === targetEmployeeId &&
             scheduleDate >= startDate &&
             scheduleDate <= endDate;
    }).length;
    
    const workedDays = timeEntries.filter(entry => {
      const entryDate = new Date(entry.clockInTime);
      return entry.employeeId === targetEmployeeId &&
             entryDate >= startDate &&
             entryDate <= endDate;
    }).length;
    
    return scheduledDays > 0 ? (workedDays / scheduledDays) * 100 : 0;
  }, [timeEntries, schedules, employeeId]);

  const getCurrentStatus = useCallback((empId?: string): 'clocked_in' | 'clocked_out' | 'on_break' | 'unknown' => {
    const targetEmployeeId = empId || employeeId;
    if (!targetEmployeeId) return 'unknown';
    
    const currentEntry = timeEntries.find(entry => 
      entry.employeeId === targetEmployeeId && !entry.clockOutTime
    );
    
    if (!currentEntry) return 'clocked_out';
    
    if (currentEntry.breakStartTime && !currentEntry.breakEndTime) {
      return 'on_break';
    }
    
    return 'clocked_in';
  }, [timeEntries, employeeId]);

  // Analytics
  const getTimeAnalytics = useCallback((
    startDate: Date,
    endDate: Date,
    empId?: string
  ): TimeAnalytics => {
    const targetEmployeeId = empId || employeeId;
    
    const relevantEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.clockInTime);
      const matchesEmployee = !targetEmployeeId || entry.employeeId === targetEmployeeId;
      const inDateRange = entryDate >= startDate && entryDate <= endDate;
      return matchesEmployee && inDateRange;
    });
    
    const totalHours = relevantEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);
    const regularHours = relevantEntries.reduce((sum, entry) => sum + (entry.regularHours || 0), 0);
    const overtimeHours = relevantEntries.reduce((sum, entry) => sum + (entry.overtimeHours || 0), 0);
    const breakTime = relevantEntries.reduce((sum, entry) => sum + (entry.totalBreakTime || 0), 0);
    const daysWorked = relevantEntries.length;
    const averageHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;
    
    const attendanceRate = getAttendanceRate(startDate, endDate, empId);
    
    // Calculate punctuality rate (on-time arrivals)
    const scheduledEntries = relevantEntries.filter(entry => {
      const entryDate = new Date(entry.clockInTime).toDateString();
      return schedules.some(schedule => 
        new Date(schedule.scheduleDate).toDateString() === entryDate &&
        schedule.employeeId === entry.employeeId
      );
    });
    
    const onTimeArrivals = scheduledEntries.filter(entry => {
      const entryDate = new Date(entry.clockInTime).toDateString();
      const schedule = schedules.find(s => 
        new Date(s.scheduleDate).toDateString() === entryDate &&
        s.employeeId === entry.employeeId
      );
      
      if (!schedule) return false;
      
      const scheduledTime = new Date(schedule.startTime);
      const actualTime = new Date(entry.clockInTime);
      
      return actualTime <= scheduledTime;
    }).length;
    
    const punctualityRate = scheduledEntries.length > 0 ? 
      (onTimeArrivals / scheduledEntries.length) * 100 : 0;
    
    return {
      totalHours,
      regularHours,
      overtimeHours,
      breakTime,
      averageHoursPerDay,
      daysWorked,
      attendanceRate,
      punctualityRate,
    };
  }, [timeEntries, schedules, employeeId, getAttendanceRate]);

  const getScheduleCompliance = useCallback((
    startDate: Date,
    endDate: Date,
    empId?: string
  ): ScheduleCompliance => {
    const targetEmployeeId = empId || employeeId;
    
    const relevantSchedules = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.scheduleDate);
      const matchesEmployee = !targetEmployeeId || schedule.employeeId === targetEmployeeId;
      const inDateRange = scheduleDate >= startDate && scheduleDate <= endDate;
      return matchesEmployee && inDateRange;
    });
    
    const scheduledHours = relevantSchedules.reduce((sum, schedule) => {
      const start = new Date(schedule.startTime);
      const end = new Date(schedule.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    
    const actualHours = getTotalHoursForPeriod(startDate, endDate, empId);
    const complianceRate = scheduledHours > 0 ? (actualHours / scheduledHours) * 100 : 0;
    
    // Calculate violations
    let lateArrivals = 0;
    let earlyDepartures = 0;
    let missedShifts = 0;
    
    relevantSchedules.forEach(schedule => {
      const scheduleDate = new Date(schedule.scheduleDate).toDateString();
      const timeEntry = timeEntries.find(entry => 
        new Date(entry.clockInTime).toDateString() === scheduleDate &&
        entry.employeeId === schedule.employeeId
      );
      
      if (!timeEntry) {
        missedShifts++;
        return;
      }
      
      const scheduledStart = new Date(schedule.startTime);
      const actualStart = new Date(timeEntry.clockInTime);
      
      if (actualStart > scheduledStart) {
        lateArrivals++;
      }
      
      if (timeEntry.clockOutTime) {
        const scheduledEnd = new Date(schedule.endTime);
        const actualEnd = new Date(timeEntry.clockOutTime);
        
        if (actualEnd < scheduledEnd) {
          earlyDepartures++;
        }
      }
    });
    
    return {
      scheduledHours,
      actualHours,
      complianceRate,
      lateArrivals,
      earlyDepartures,
      missedShifts,
    };
  }, [schedules, timeEntries, employeeId, getTotalHoursForPeriod]);

  return {
    // Data
    timeEntries,
    schedules,
    currentTimeEntry,
    todaySchedule,
    
    // Loading states
    timeEntriesLoading,
    schedulesLoading,
    clockingLoading,
    
    // Error states
    error: error as Error | null,
    
    // Time tracking operations
    clockIn,
    clockOut,
    createTimeEntry,
    updateTimeEntry,
    approveTimeEntry,
    
    // Schedule operations
    createSchedule,
    updateSchedule,
    
    // Data fetching
    refetchTimeEntries,
    refetchSchedules,
    
    // Filtering
    setTimeEntryFilters,
    setDateRange,
    
    // Utilities
    isCurrentlyWorking,
    getTotalHoursForPeriod,
    getOvertimeHours,
    getAttendanceRate,
    getCurrentStatus,
    
    // Analytics
    getTimeAnalytics,
    getScheduleCompliance,
  };
}
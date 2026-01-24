/**
 * Reports Hook
 * Comprehensive hook for report generation and management
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_REPORTS,
  GET_REPORT,
  GET_REPORT_EXECUTION,
  EXECUTE_REPORT,
} from '@/graphql/queries/analytics-queries';
import {
  CREATE_REPORT,
  UPDATE_REPORT,
  DELETE_REPORT,
  SCHEDULE_REPORT,
  UNSCHEDULE_REPORT,
  EXPORT_REPORT,
  CREATE_REPORTS,
  EXECUTE_REPORTS,
} from '@/graphql/mutations/analytics-mutations';
import type {
  Report,
  ReportExecution,
  ScheduledReport,
  CreateReportInput,
  UpdateReportInput,
  ExecuteReportInput,
  ScheduleReportInput,
  UseReportsResult,
} from '@/types/analytics';

export function useReports(): UseReportsResult {
  const [reports, setReports] = useState<Report[]>([]);
  const [currentReport, setCurrentReport] = useState<Report | undefined>();
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  // Queries
  const {
    data: reportsData,
    loading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = useQuery(GET_REPORTS, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  // Mutations
  const [createReportMutation, { loading: createLoading }] = useMutation(CREATE_REPORT);
  const [updateReportMutation, { loading: updateLoading }] = useMutation(UPDATE_REPORT);
  const [deleteReportMutation, { loading: deleteLoading }] = useMutation(DELETE_REPORT);
  const [scheduleReportMutation, { loading: scheduleLoading }] = useMutation(SCHEDULE_REPORT);
  const [unscheduleReportMutation] = useMutation(UNSCHEDULE_REPORT);
  const [exportReportMutation] = useMutation(EXPORT_REPORT);
  const [createReportsMutation] = useMutation(CREATE_REPORTS);
  const [executeReportsMutation] = useMutation(EXECUTE_REPORTS);

  // Update state when query data changes
  useEffect(() => {
    if (reportsData?.reports) {
      setReports(reportsData.reports);
    }
  }, [reportsData]);

  // Actions
  const getReports = useCallback(async (): Promise<Report[]> => {
    try {
      const { data } = await refetchReports();
      return data?.reports || [];
    } catch (error) {
      console.error('Failed to get reports:', error);
      throw error;
    }
  }, [refetchReports]);

  const getReport = useCallback(async (reportId: string): Promise<Report> => {
    try {
      // This would typically use a separate query for single report
      const report = reports.find(r => r.id === reportId);
      if (report) {
        setCurrentReport(report);
        return report;
      }
      throw new Error(`Report not found: ${reportId}`);
    } catch (error) {
      console.error('Failed to get report:', error);
      throw error;
    }
  }, [reports]);

  const createReport = useCallback(async (input: CreateReportInput): Promise<Report> => {
    try {
      const { data } = await createReportMutation({
        variables: { input },
        update: (cache, { data }) => {
          if (data?.createReport) {
            const existingReports = cache.readQuery({ query: GET_REPORTS });
            cache.writeQuery({
              query: GET_REPORTS,
              data: {
                reports: [...(existingReports?.reports || []), data.createReport],
              },
            });
          }
        },
      });
      
      if (data?.createReport) {
        setReports(prev => [...prev, data.createReport]);
        return data.createReport;
      }
      throw new Error('Failed to create report');
    } catch (error) {
      console.error('Failed to create report:', error);
      throw error;
    }
  }, [createReportMutation]);

  const updateReport = useCallback(async (reportId: string, input: UpdateReportInput): Promise<Report> => {
    try {
      const { data } = await updateReportMutation({
        variables: { reportId, input },
        update: (cache, { data }) => {
          if (data?.updateReport) {
            const existingReports = cache.readQuery({ query: GET_REPORTS });
            const updatedReports = existingReports?.reports?.map((report: Report) =>
              report.id === reportId ? data.updateReport : report
            ) || [];
            cache.writeQuery({
              query: GET_REPORTS,
              data: { reports: updatedReports },
            });
          }
        },
      });
      
      if (data?.updateReport) {
        setReports(prev => prev.map(r => r.id === reportId ? data.updateReport : r));
        return data.updateReport;
      }
      throw new Error('Failed to update report');
    } catch (error) {
      console.error('Failed to update report:', error);
      throw error;
    }
  }, [updateReportMutation]);

  const deleteReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      const { data } = await deleteReportMutation({
        variables: { reportId },
        update: (cache) => {
          const existingReports = cache.readQuery({ query: GET_REPORTS });
          const filteredReports = existingReports?.reports?.filter((report: Report) => 
            report.id !== reportId
          ) || [];
          cache.writeQuery({
            query: GET_REPORTS,
            data: { reports: filteredReports },
          });
        },
      });
      
      if (data?.deleteReport) {
        setReports(prev => prev.filter(r => r.id !== reportId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete report:', error);
      throw error;
    }
  }, [deleteReportMutation]);

  const executeReport = useCallback(async (input: ExecuteReportInput): Promise<ReportExecution> => {
    try {
      // This would use the EXECUTE_REPORT query
      const execution: ReportExecution = {
        id: `exec_${Date.now()}`,
        reportId: input.reportId,
        status: 'QUEUED',
        startedAt: new Date(),
      };
      
      setExecutions(prev => [...prev, execution]);
      return execution;
    } catch (error) {
      console.error('Failed to execute report:', error);
      throw error;
    }
  }, []);

  const scheduleReport = useCallback(async (input: ScheduleReportInput): Promise<ScheduledReport> => {
    try {
      const { data } = await scheduleReportMutation({
        variables: { input },
      });
      
      if (data?.scheduleReport) {
        setScheduledReports(prev => [...prev, data.scheduleReport]);
        return data.scheduleReport;
      }
      throw new Error('Failed to schedule report');
    } catch (error) {
      console.error('Failed to schedule report:', error);
      throw error;
    }
  }, [scheduleReportMutation]);

  const unscheduleReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      const { data } = await unscheduleReportMutation({
        variables: { reportId },
      });
      
      if (data?.unscheduleReport) {
        setScheduledReports(prev => prev.filter(sr => sr.reportId !== reportId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to unschedule report:', error);
      throw error;
    }
  }, [unscheduleReportMutation]);

  const exportReport = useCallback(async (reportId: string, format: string): Promise<string> => {
    try {
      const { data } = await exportReportMutation({
        variables: { reportId, format },
      });
      
      return data?.exportReport || '';
    } catch (error) {
      console.error('Failed to export report:', error);
      throw error;
    }
  }, [exportReportMutation]);

  const createReports = useCallback(async (inputs: CreateReportInput[]): Promise<Report[]> => {
    try {
      const { data } = await createReportsMutation({
        variables: { inputs },
      });
      
      if (data?.createReports) {
        setReports(prev => [...prev, ...data.createReports]);
        return data.createReports;
      }
      return [];
    } catch (error) {
      console.error('Failed to create reports:', error);
      throw error;
    }
  }, [createReportsMutation]);

  const executeReports = useCallback(async (reportIds: string[]): Promise<ReportExecution[]> => {
    try {
      const { data } = await executeReportsMutation({
        variables: { reportIds },
      });
      
      if (data?.executeReports) {
        setExecutions(prev => [...prev, ...data.executeReports]);
        return data.executeReports;
      }
      return [];
    } catch (error) {
      console.error('Failed to execute reports:', error);
      throw error;
    }
  }, [executeReportsMutation]);

  return {
    // Data
    reports,
    currentReport,
    executions,
    scheduledReports,
    
    // Loading states
    reportsLoading,
    reportLoading: createLoading || updateLoading || deleteLoading,
    executionLoading: scheduleLoading,
    
    // Error states
    reportsError: reportsError || undefined,
    reportError: undefined,
    executionError: undefined,
    
    // Actions
    getReports,
    getReport,
    createReport,
    updateReport,
    deleteReport,
    executeReport,
    scheduleReport,
    unscheduleReport,
    exportReport,
    
    // Batch operations
    createReports,
    executeReports,
  };
}
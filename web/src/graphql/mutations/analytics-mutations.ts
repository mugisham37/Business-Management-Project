import { gql } from '@apollo/client';

// ============================================================================
// ANALYTICS MUTATIONS - Complete coverage of backend analytics mutations
// ============================================================================

// Core Analytics Mutations
export const INITIALIZE_ANALYTICS = gql`
  mutation InitializeAnalytics($config: String!) {
    initializeAnalytics(config: $config)
  }
`;

export const TRACK_EVENT = gql`
  mutation TrackEvent($eventName: String!, $eventData: String!) {
    trackEvent(eventName: $eventName, eventData: $eventData)
  }
`;

// Dashboard Mutations
export const CREATE_DASHBOARD = gql`
  mutation CreateDashboard($name: String!, $description: String) {
    createDashboard(name: $name, description: $description) {
      id
      tenantId
      name
      description
      widgets {
        id
        title
        type
        data
        x
        y
        width
        height
      }
      isPublic
      createdAt
      updatedAt
      createdBy
      version
    }
  }
`;

// Reporting Mutations
export const CREATE_REPORT = gql`
  mutation CreateReport($input: CreateReportInput!) {
    createReport(input: $input) {
      id
      tenantId
      name
      description
      reportType
      status
      metrics
      dimensions
      schedule
      createdAt
      updatedAt
      createdBy
      version
    }
  }
`;

export const UPDATE_REPORT = gql`
  mutation UpdateReport($reportId: ID!, $input: CreateReportInput!) {
    updateReport(reportId: $reportId, input: $input) {
      id
      tenantId
      name
      description
      reportType
      status
      metrics
      dimensions
      schedule
      createdAt
      updatedAt
      createdBy
      version
    }
  }
`;

export const DELETE_REPORT = gql`
  mutation DeleteReport($reportId: ID!) {
    deleteReport(reportId: $reportId)
  }
`;

export const SCHEDULE_REPORT = gql`
  mutation ScheduleReport($input: ScheduleReportInput!) {
    scheduleReport(input: $input) {
      id
      reportId
      schedule
      isActive
      nextRunAt
      lastRunAt
    }
  }
`;

export const UNSCHEDULE_REPORT = gql`
  mutation UnscheduleReport($reportId: ID!) {
    unscheduleReport(reportId: $reportId)
  }
`;

export const EXPORT_REPORT = gql`
  mutation ExportReport($reportId: ID!, $format: String!) {
    exportReport(reportId: $reportId, format: $format)
  }
`;

export const CREATE_REPORTS = gql`
  mutation CreateReports($inputs: [CreateReportInput!]!) {
    createReports(inputs: $inputs) {
      id
      tenantId
      name
      description
      reportType
      status
      metrics
      dimensions
      schedule
      createdAt
      updatedAt
      createdBy
      version
    }
  }
`;

export const EXECUTE_REPORTS = gql`
  mutation ExecuteReports($reportIds: [ID!]!) {
    executeReports(reportIds: $reportIds) {
      id
      reportId
      status
      jobId
      startedAt
      completedAt
      error
      result
    }
  }
`;

// Data Warehouse Mutations
export const CREATE_TENANT_SCHEMA = gql`
  mutation CreateTenantSchema($schemaConfig: String!) {
    createTenantSchema(schemaConfig: $schemaConfig)
  }
`;

export const OPTIMIZE_WAREHOUSE = gql`
  mutation OptimizeWarehouse($optimizationConfig: String) {
    optimizeWarehouse(optimizationConfig: $optimizationConfig)
  }
`;

export const CREATE_PARTITIONS = gql`
  mutation CreatePartitions($partitionConfig: String!) {
    createPartitions(partitionConfig: $partitionConfig)
  }
`;

// ETL Mutations
export const SETUP_ETL_PIPELINES = gql`
  mutation SetupETLPipelines($config: String!) {
    setupETLPipelines(config: $config)
  }
`;

export const EXECUTE_PIPELINE = gql`
  mutation ExecutePipeline($pipelineId: String!, $parameters: String) {
    executePipeline(pipelineId: $pipelineId, parameters: $parameters)
  }
`;

export const RECONFIGURE_PIPELINES = gql`
  mutation ReconfigurePipelines($config: String!) {
    reconfigurePipelines(config: $config)
  }
`;

export const CREATE_PIPELINE = gql`
  mutation CreatePipeline($pipelineConfig: String!) {
    createPipeline(pipelineConfig: $pipelineConfig)
  }
`;

export const DELETE_PIPELINE = gql`
  mutation DeletePipeline($pipelineId: String!) {
    deletePipeline(pipelineId: $pipelineId)
  }
`;

// Input type definitions for TypeScript
export interface MetricsFilterInput {
  categories?: string[];
  startDate?: Date;
  endDate?: Date;
  metricNames?: string[];
  dimensions?: string[];
}

export interface KPIFilterInput {
  kpiNames?: string[];
  status?: string;
  period?: string;
}

export interface TrendFilterInput {
  metricNames?: string[];
  startDate?: Date;
  endDate?: Date;
  granularity?: string;
  limit?: number;
}

export interface CreateReportInput {
  name: string;
  description?: string;
  reportType: string;
  metrics: string[];
  dimensions?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface ExecuteReportInput {
  reportId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScheduleReportInput {
  reportId: string;
  schedule: string;
  timezone?: string;
}

export interface TimePeriodComparisonInput {
  currentStartDate: Date;
  currentEndDate: Date;
  comparisonStartDate: Date;
  comparisonEndDate: Date;
  metricNames?: string[];
}

export interface LocationComparisonInput {
  locationIds: string[];
  metricNames: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface SegmentComparisonInput {
  segmentIds: string[];
  metricNames: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface DashboardFilterInput {
  name?: string;
  createdBy?: string;
  isPublic?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ReportFilterInput {
  name?: string;
  reportType?: string;
  status?: string;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface AnalyticsQueryInput {
  name: string;
  description?: string;
  sql: string;
  dimensions: string[];
  measures: string[];
  parameters?: string;
  limit?: number;
}

export interface ETLPipelineInput {
  name: string;
  description?: string;
  sourceType: string;
  sourceConfig: string;
  transformConfig: string;
  destinationConfig: string;
  schedule?: string;
  isActive?: boolean;
}

export interface PredictiveModelTrainingInput {
  modelName: string;
  modelType: string;
  features: string[];
  targetVariable: string;
  trainingConfig?: string;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
}

export interface AnalyticsConfigurationInput {
  dataRetentionPeriod: string;
  aggregationLevel: string;
  enabledMetrics: string[];
  customSettings?: string;
  enableRealTimeProcessing?: boolean;
  enablePredictiveAnalytics?: boolean;
}
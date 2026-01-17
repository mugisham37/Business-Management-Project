# Disaster Recovery Module

A comprehensive, GraphQL-first disaster recovery module providing enterprise-grade business continuity, failover management, data replication, and recovery time optimization capabilities.

## 🚀 Features

### Core Functionality
- **Disaster Recovery Planning**: Create, manage, and execute comprehensive DR plans
- **Automatic Failover**: Intelligent failover with health monitoring and automatic recovery
- **Data Replication**: Multi-region data replication with lag monitoring
- **Business Continuity**: Graceful service degradation and recovery
- **RTO Optimization**: Advanced analytics and optimization recommendations
- **Data Management**: Granular recovery, archival, and secure data destruction
- **Real-time Monitoring**: Live updates via GraphQL subscriptions

### GraphQL-First Architecture
- **Complete GraphQL API**: All operations exposed via GraphQL
- **Real-time Subscriptions**: Live updates for all critical events
- **Field Resolvers**: Computed fields and related data fetching
- **Input Validation**: Comprehensive validation with custom decorators
- **Error Handling**: Structured error responses with detailed messaging

### Enterprise Features
- **Multi-tenant Support**: Complete tenant isolation and security
- **Role-based Access Control**: Granular permissions and authorization
- **Audit Logging**: Comprehensive audit trail for compliance
- **Metrics Collection**: Performance monitoring and analytics
- **Queue Processing**: Asynchronous processing for long-running operations
- **Scheduled Tasks**: Automated testing and maintenance

## 📁 Module Structure

```
src/modules/disaster-recovery/
├── decorators/           # Custom GraphQL decorators
├── entities/            # Database entities and GraphQL types
├── guards/              # Authorization and access control guards
├── inputs/              # GraphQL input types and validation
├── interceptors/        # Logging and metrics interceptors
├── processors/          # Queue processors for async operations
├── repositories/        # Data access layer
├── resolvers/           # GraphQL resolvers
├── services/            # Business logic layer
├── types/               # GraphQL response types
└── disaster-recovery.module.ts
```

## 🔧 Services

### DisasterRecoveryService
Core service for DR plan management and execution.

**Key Methods:**
- `createDRPlan()` - Create disaster recovery plans
- `executeDR()` - Execute disaster recovery procedures
- `testDRPlan()` - Run DR tests and validations
- `getDRMetrics()` - Retrieve performance metrics

### FailoverService
Manages automatic and manual failover operations.

**Key Methods:**
- `createFailoverConfig()` - Configure failover settings
- `executeFailover()` - Perform failover operations
- `checkEndpointHealth()` - Monitor service health
- `getFailoverMetrics()` - Retrieve failover statistics

### ReplicationService
Handles data replication across regions.

**Key Methods:**
- `createReplication()` - Set up data replication
- `getReplicationStatus()` - Monitor replication health
- `getReplicationMetrics()` - Retrieve replication statistics
- `monitorReplicationLag()` - Automated lag monitoring

### BusinessContinuityService
Manages service degradation and recovery.

**Key Methods:**
- `implementGracefulDegradation()` - Degrade services gracefully
- `restoreServiceFromDegradation()` - Restore degraded services
- `getBusinessContinuityMetrics()` - Retrieve BC metrics
- `testBusinessContinuity()` - Run BC tests

### DataManagementService
Handles data recovery, archival, and destruction.

**Key Methods:**
- `performGranularRecovery()` - Granular data recovery
- `createArchivalPolicy()` - Set up data archival
- `scheduleSecureDestruction()` - Schedule secure data deletion
- `generateDRReport()` - Generate compliance reports

### RecoveryTimeOptimizationService
Provides RTO analysis and optimization.

**Key Methods:**
- `analyzeRTOPerformance()` - Analyze RTO performance
- `generateRTOImprovementPlan()` - Create optimization plans
- `monitorRTOTrends()` - Track RTO trends over time

### DisasterRecoveryProceduresService
Manages DR procedure execution and validation.

**Key Methods:**
- `executeProcedures()` - Execute DR procedures
- `validateProcedures()` - Validate DR procedures
- `generateStandardProcedures()` - Generate standard procedures

## 🔍 GraphQL API

### Queries

```graphql
# Get all DR plans
query GetDRPlans($filter: DRPlansFilterInput) {
  drPlans(filter: $filter) {
    success
    data {
      id
      name
      description
      rtoMinutes
      rpoMinutes
      healthStatus
      estimatedRTO
      activeFailovers
      replicationStatus
    }
  }
}

# Get DR metrics
query GetDRMetrics {
  drMetrics {
    success
    data {
      averageRtoMinutes
      successRate
      totalExecutions
      healthScore
    }
  }
}

# Get business continuity metrics
query GetBusinessContinuityMetrics {
  businessContinuityMetrics
}
```

### Mutations

```graphql
# Create DR plan
mutation CreateDRPlan($input: CreateDRPlanInput!) {
  createDRPlan(input: $input) {
    success
    data {
      id
      name
      description
    }
    message
  }
}

# Execute DR
mutation ExecuteDR($planId: ID!, $input: ExecuteDRInput!) {
  executeDR(planId: $planId, input: $input) {
    success
    data {
      id
      status
      actualRtoMinutes
    }
    message
  }
}

# Execute failover
mutation ExecuteFailover($input: ExecuteFailoverInput!) {
  executeFailover(input: $input) {
    success
    data {
      id
      status
      failoverTimeSeconds
    }
    message
  }
}

# Implement graceful degradation
mutation ImplementGracefulDegradation(
  $serviceName: String!
  $degradationLevel: Int!
  $reason: String!
) {
  implementGracefulDegradation(
    serviceName: $serviceName
    degradationLevel: $degradationLevel
    reason: $reason
  )
}
```

### Subscriptions

```graphql
# Monitor DR executions
subscription DrExecutionStarted {
  drExecutionStarted
}

subscription DrExecutionCompleted {
  drExecutionCompleted
}

# Monitor failover events
subscription FailoverExecuted {
  failoverExecuted
}

# Monitor replication lag
subscription ReplicationLagWarning {
  replicationLagWarning
}

# Monitor service health
subscription ServiceDegraded {
  serviceDegraded
}

subscription ServiceRestored {
  serviceRestored
}
```

## 🛡️ Security & Authorization

### Guards
- **DRPlanAccessGuard**: Validates access to DR plans
- **FailoverAccessGuard**: Controls failover operations
- **ReplicationAccessGuard**: Manages replication access
- **ExecutionPermissionGuard**: Validates execution permissions

### Decorators
- **@CurrentDRPlan**: Extract DR plan from context
- **@ValidateDRPlanAccess**: Validate plan access
- **@CurrentFailoverConfig**: Extract failover config
- **@ValidateFailoverAccess**: Validate failover access
- **@ServiceHealthContext**: Extract service health context

### Permissions
- `disaster_recovery:read` - Read DR data
- `disaster_recovery:create` - Create DR resources
- `disaster_recovery:update` - Update DR resources
- `disaster_recovery:delete` - Delete DR resources
- `disaster_recovery:execute` - Execute DR operations
- `disaster_recovery:test` - Run DR tests

## 📊 Monitoring & Metrics

### Interceptors
- **DRLoggingInterceptor**: Comprehensive operation logging
- **DRMetricsInterceptor**: Performance metrics collection

### Metrics Collected
- Operation duration and success rates
- RTO/RPO performance
- Failover execution times
- Replication lag statistics
- Service health scores
- Business continuity metrics

## 🔄 Queue Processing

### Queues
- **disaster-recovery-queue**: DR execution processing
- **failover-queue**: Failover operation processing

### Processors
- **DisasterRecoveryProcessor**: Handles DR execution jobs
- **FailoverProcessor**: Handles failover execution jobs

## 📅 Scheduled Tasks

### Automated Operations
- **Monthly DR Testing**: Automated DR plan testing
- **Health Monitoring**: Continuous service health checks
- **Replication Monitoring**: Real-time replication lag monitoring
- **Data Archival**: Automated data archival execution
- **Retention Enforcement**: Automated data retention policies

## 🧪 Testing

Run the integration tests:

```bash
npm test disaster-recovery.integration.test.ts
```

The test suite covers:
- GraphQL schema generation
- Service integration
- Component injection
- Operation coverage
- Security features

## 🚀 Usage Examples

### Basic DR Plan Creation

```typescript
import { DisasterRecoveryService } from './services/disaster-recovery.service';

// Create a DR plan
const plan = await drService.createDRPlan({
  tenantId: 'tenant-123',
  name: 'Production DR Plan',
  description: 'Main production disaster recovery plan',
  disasterTypes: [DisasterType.HARDWARE_FAILURE, DisasterType.NETWORK_OUTAGE],
  rtoMinutes: 15,
  rpoMinutes: 5,
  primaryRegion: 'us-east-1',
  secondaryRegions: ['us-west-2', 'eu-west-1'],
  automaticFailover: true,
  configuration: {
    notifications: ['email', 'sms'],
    escalation: ['manager', 'cto'],
  },
  userId: 'user-123',
});
```

### Execute DR via GraphQL

```graphql
mutation ExecuteDisasterRecovery {
  executeDR(
    planId: "plan-123"
    input: {
      disasterType: HARDWARE_FAILURE
      isTest: false
    }
  ) {
    success
    data {
      id
      status
      actualRtoMinutes
    }
    message
  }
}
```

### Monitor Real-time Events

```typescript
// Subscribe to DR events
const subscription = gql`
  subscription MonitorDREvents {
    drExecutionStarted
    drExecutionCompleted
    failoverExecuted
    replicationLagWarning
    serviceDegraded
    serviceRestored
  }
`;
```

## 🔧 Configuration

### Environment Variables

```env
# Queue Configuration
REDIS_URL=redis://localhost:6379
DR_QUEUE_CONCURRENCY=5
FAILOVER_QUEUE_CONCURRENCY=3

# Monitoring Configuration
DR_HEALTH_CHECK_INTERVAL=30000
REPLICATION_LAG_THRESHOLD=300
RTO_TARGET_MINUTES=15

# Notification Configuration
DR_NOTIFICATION_CHANNELS=email,sms,slack
DR_ESCALATION_TIMEOUT=300
```

### Module Configuration

```typescript
@Module({
  imports: [
    DisasterRecoveryModule,
    // ... other modules
  ],
})
export class AppModule {}
```

## 📈 Performance Optimization

### Best Practices
1. **Use Field Resolvers**: Leverage computed fields for dynamic data
2. **Implement Caching**: Cache frequently accessed data
3. **Optimize Queries**: Use DataLoader for N+1 query prevention
4. **Monitor Metrics**: Track performance with interceptors
5. **Queue Long Operations**: Use async processing for heavy operations

### Scaling Considerations
- **Horizontal Scaling**: Multiple queue workers
- **Database Optimization**: Proper indexing and partitioning
- **Caching Strategy**: Redis for session and query caching
- **Load Balancing**: Distribute GraphQL requests
- **Monitoring**: Comprehensive metrics and alerting

## 🤝 Contributing

1. Follow the established patterns for services, resolvers, and types
2. Add comprehensive tests for new functionality
3. Update GraphQL schema documentation
4. Ensure proper error handling and logging
5. Add metrics collection for new operations

## 📄 License

This module is part of the unified business management platform and follows the same licensing terms.
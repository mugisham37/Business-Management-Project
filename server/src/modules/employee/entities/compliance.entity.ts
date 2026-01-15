import { 
  ComplianceCheckType, 
  ComplianceStatus, 
  ViolationType, 
  ViolationSeverity, 
  BreakType 
} from '../dto/compliance.dto';

export interface ComplianceCheck {
  id: string;
  tenantId: string;
  employeeId: string;
  checkDate: string;
  checkType: ComplianceCheckType;
  status: ComplianceStatus;
  violations?: any[];
  totalViolations?: number;
  notes?: string;
  details?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface BreakTimeRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  breakType: BreakType;
  duration?: number; // in minutes
  isPaid?: boolean;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface LaborLawViolation {
  id: string;
  tenantId: string;
  employeeId: string;
  complianceCheckId?: string;
  violationType: ViolationType;
  violationDate: string;
  description: string;
  severity: ViolationSeverity;
  details?: Record<string, any>;
  correctiveAction?: string;
  correctedDate?: string;
  correctedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  employeeId?: string;
  eventType: string;
  eventDate: string;
  performedBy: string;
  description: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
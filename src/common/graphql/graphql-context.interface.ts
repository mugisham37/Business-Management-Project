import { Request, Response } from 'express';

export interface GraphQLContext {
  req: Request & {
    user?: {
      id: string;
      email: string;
      tenantId: string;
      roles: string[];
      permissions: string[];
    };
    tenantId?: string;
    requestId?: string;
  };
  res: Response;
  user?: {
    id: string;
    email: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
  tenantId?: string;
  requestId?: string;
}

export interface GraphQLSubscriptionContext {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
  tenantId?: string;
  connectionParams?: Record<string, any>;
}
-- Initialize database with row-level security and multi-tenancy support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create app configuration schema for tenant context
CREATE SCHEMA IF NOT EXISTS app_config;

-- Function to get current tenant ID from session
CREATE OR REPLACE FUNCTION app_config.current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_tenant_id', true)::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION app_config.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.is_super_admin', true)::BOOLEAN,
    false
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a function to automatically set tenant_id and audit fields
CREATE OR REPLACE FUNCTION app_config.set_tenant_and_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Set tenant_id if not already set (for tenant-isolated tables)
  IF TG_TABLE_NAME != 'tenants' AND TG_TABLE_NAME != 'audit_logs' THEN
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := app_config.current_tenant_id();
    END IF;
  END IF;

  -- Set audit fields
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    NEW.version := COALESCE(NEW.version, 1);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
    NEW.version := OLD.version + 1;
    -- Preserve created_at and created_by
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function for audit logging
CREATE OR REPLACE FUNCTION app_config.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  audit_data JSONB;
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Convert OLD and NEW to JSONB, excluding sensitive fields
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    old_data := old_data - 'password_hash' - 'mfa_secret' - 'password_reset_token';
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    new_data := to_jsonb(NEW);
    new_data := new_data - 'password_hash' - 'mfa_secret' - 'password_reset_token';
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    old_data := old_data - 'password_hash' - 'mfa_secret' - 'password_reset_token';
  END IF;

  -- Insert audit record
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    resource,
    resource_id,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent,
    request_id
  ) VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'tenants' THEN NULL
      ELSE app_config.current_tenant_id()
    END,
    COALESCE(
      current_setting('app.current_user_id', true)::UUID,
      NULL
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    TG_TABLE_NAME,
    CASE TG_OP
      WHEN 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    old_data,
    new_data,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'timestamp', NOW()
    ),
    current_setting('app.client_ip', true),
    current_setting('app.user_agent', true),
    COALESCE(
      current_setting('app.request_id', true)::UUID,
      NULL
    )
  );

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA app_config TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_config TO PUBLIC;
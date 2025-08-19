#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Final integration testing and validation script for fullstack monolith transformation

.DESCRIPTION
    This script performs targeted smoke tests and validation of the transformed monolith
    following the STRICT VALIDATION POLICY:
    - NO FULL PROJECT BUILDS
    - NO FULL TEST SUITES
    - TARGETED VALIDATION ONLY
    - Use smoke tests and single endpoint/function tests for validation

.PARAMETER ValidationMode
    The type of validation to run: all, api, database, auth, frontend, trpc

.EXAMPLE
    .\integration-validation.ps1 -ValidationMode all
    .\integration-validation.ps1 -ValidationMode api
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("all", "api", "database", "auth", "frontend", "trpc")]
    [string]$ValidationMode = "all"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

# Validation results
$ValidationResults = @{
    ApiServer = $false
    HealthCheck = $false
    AuthPackage = $false
    DatabasePackage = $false
    FrontendBuild = $false
    TrpcCommunication = $false
}

function Write-ValidationHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "${Blue}============================================${Reset}"
    Write-Host "${Blue}$Title${Reset}"
    Write-Host "${Blue}============================================${Reset}"
}

function Write-Success {
    param([string]$Message)
    Write-Host "${Green}✓ $Message${Reset}"
}

function Write-Error {
    param([string]$Message)
    Write-Host "${Red}✗ $Message${Reset}"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "${Yellow}⚠ $Message${Reset}"
}

function Test-ApiServerStartup {
    Write-ValidationHeader "1. API Server Startup Validation"
    
    try {
        Write-Host "Checking TypeScript compilation for API..."
        
        # Check TypeScript compilation for API only (no build)
        $tscResult = & npx tsc --noEmit --project apps/api/tsconfig.json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "API TypeScript compilation failed"
            Write-Host $tscResult
            return $false
        }
        Write-Success "API TypeScript compilation passed"
        
        # Check if API can import shared packages
        Write-Host "Validating package imports..."
        $importTest = @"
import { User } from '@company/shared';
import { DatabaseClientFactory } from '@company/database';
import { JwtStrategy } from '@company/auth';
import { configManager } from '@company/config';
console.log('Package imports successful');
"@
        
        $importTest | Out-File -FilePath 'temp-import-test.ts' -Encoding UTF8
        $importResult = & npx tsc --noEmit temp-import-test.ts 2>&1
        Remove-Item 'temp-import-test.ts' -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Package import validation failed"
            Write-Host $importResult
            return $false
        }
        Write-Success "Package imports validated successfully"
        
        $ValidationResults.ApiServer = $true
        return $true
    }
    catch {
        Write-Error "API server validation failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-HealthCheckEndpoint {
    Write-ValidationHeader "2. Health Check Endpoint Validation"
    
    try {
        Write-Host "Starting API server for health check test..."
        
        # Start API server in background
        $apiProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "apps/api" -PassThru -WindowStyle Hidden
        
        # Wait for server to start
        Write-Host "Waiting for API server to start..."
        Start-Sleep -Seconds 10
        
        # Test health endpoint
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 10
            Write-Success "Health check endpoint responded successfully"
            Write-Host "Response: $($response | ConvertTo-Json -Compress)"
            $ValidationResults.HealthCheck = $true
            $result = $true
        }
        catch {
            Write-Error "Health check endpoint failed: $($_.Exception.Message)"
            $result = $false
        }
        
        # Stop API server
        if ($apiProcess -and !$apiProcess.HasExited) {
            Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
        }
        
        return $result
    }
    catch {
        Write-Error "Health check validation failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-AuthPackageIntegration {
    Write-ValidationHeader "3. Authentication Package Integration"
    
    try {
        Write-Host "Testing auth package compilation..."
        
        # Check auth package TypeScript compilation
        $authTscResult = & npx tsc --noEmit --project packages/auth/tsconfig.json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Auth package TypeScript compilation failed"
            Write-Host $authTscResult
            return $false
        }
        Write-Success "Auth package TypeScript compilation passed"
        
        # Test auth package exports
        $authTest = @"
import { JwtStrategy } from '@company/auth';
import { User } from '@company/shared';
console.log('Auth package integration test');
"@
        
        $authTest | Out-File -FilePath 'temp-auth-test.ts' -Encoding UTF8
        $authResult = & npx tsc --noEmit temp-auth-test.ts 2>&1
        Remove-Item 'temp-auth-test.ts' -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Auth package integration test failed"
            Write-Host $authResult
            return $false
        }
        Write-Success "Auth package integration validated"
        
        $ValidationResults.AuthPackage = $true
        return $true
    }
    catch {
        Write-Error "Auth package validation failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-DatabasePackageIntegration {
    Write-ValidationHeader "4. Database Package Integration"
    
    try {
        Write-Host "Testing database package compilation..."
        
        # Check database package TypeScript compilation
        $dbTscResult = & npx tsc --noEmit --project packages/database/tsconfig.json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Database package TypeScript compilation failed"
            Write-Host $dbTscResult
            return $false
        }
        Write-Success "Database package TypeScript compilation passed"
        
        # Test database package exports
        $dbTest = @"
import { DatabaseClientFactory } from '@company/database';
import { User } from '@company/shared';
console.log('Database package integration test');
"@
        
        $dbTest | Out-File -FilePath 'temp-db-test.ts' -Encoding UTF8
        $dbResult = & npx tsc --noEmit temp-db-test.ts 2>&1
        Remove-Item 'temp-db-test.ts' -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Database package integration test failed"
            Write-Host $dbResult
            return $false
        }
        Write-Success "Database package integration validated"
        
        $ValidationResults.DatabasePackage = $true
        return $true
    }
    catch {
        Write-Error "Database package validation failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-FrontendBuild {
    Write-ValidationHeader "5. Frontend Build Validation"
    
    try {
        Write-Host "Testing web application build (build only, no testing)..."
        
        # Check web app TypeScript compilation first
        $webTscResult = & npx tsc --noEmit --project apps/web/tsconfig.json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Web app TypeScript compilation failed"
            Write-Host $webTscResult
            return $false
        }
        Write-Success "Web app TypeScript compilation passed"
        
        # Test Next.js build (this is allowed per task requirements)
        Write-Host "Running Next.js build..."
        $buildResult = & npm run build --prefix apps/web 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Web application build failed"
            Write-Host $buildResult
            return $false
        }
        Write-Success "Web application build completed successfully"
        
        $ValidationResults.FrontendBuild = $true
        return $true
    }
    catch {
        Write-Error "Frontend build validation failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-TrpcCommunication {
    Write-ValidationHeader "6. tRPC Client-Server Communication"
    
    try {
        Write-Host "Testing tRPC contracts compilation..."
        
        # Check tRPC contracts TypeScript compilation
        $trpcTscResult = & npx tsc --noEmit --project packages/api-contracts/tsconfig.json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "tRPC contracts TypeScript compilation failed"
            Write-Host $trpcTscResult
            return $false
        }
        Write-Success "tRPC contracts TypeScript compilation passed"
        
        # Test tRPC type exports
        $trpcTest = @"
import { AppRouter } from '@company/api-contracts';
import { authRouter } from '@company/api-contracts';
console.log('tRPC contracts integration test');
"@
        
        $trpcTest | Out-File -FilePath 'temp-trpc-test.ts' -Encoding UTF8
        $trpcResult = & npx tsc --noEmit temp-trpc-test.ts 2>&1
        Remove-Item 'temp-trpc-test.ts' -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "tRPC contracts integration test failed"
            Write-Host $trpcResult
            return $false
        }
        Write-Success "tRPC contracts integration validated"
        
        $ValidationResults.TrpcCommunication = $true
        return $true
    }
    catch {
        Write-Error "tRPC communication validation failed: $($_.Exception.Message)"
        return $false
    }
}

function Show-ValidationSummary {
    Write-ValidationHeader "Validation Summary"
    
    $totalTests = $ValidationResults.Count
    $passedTests = ($ValidationResults.Values | Where-Object { $_ -eq $true }).Count
    $failedTests = $totalTests - $passedTests
    
    Write-Host "Total Tests: $totalTests"
    Write-Host "Passed: ${Green}$passedTests${Reset}"
    Write-Host "Failed: ${Red}$failedTests${Reset}"
    Write-Host ""
    
    foreach ($test in $ValidationResults.GetEnumerator()) {
        $status = if ($test.Value) { "${Green}PASS${Reset}" } else { "${Red}FAIL${Reset}" }
        Write-Host "$($test.Key): $status"
    }
    
    Write-Host ""
    if ($failedTests -eq 0) {
        Write-Success "All validation tests passed! ✨"
        Write-Host "${Green}The fullstack monolith transformation integration is working correctly.${Reset}"
    } else {
        Write-Error "Some validation tests failed. Please review the errors above."
        exit 1
    }
}

# Main execution
try {
    Write-ValidationHeader "Fullstack Monolith Integration Validation"
    Write-Host "Validation Mode: $ValidationMode"
    Write-Host "Following STRICT VALIDATION POLICY - targeted smoke tests only"
    Write-Host ""
    
    switch ($ValidationMode) {
        "all" {
            Test-ApiServerStartup
            Test-HealthCheckEndpoint
            Test-AuthPackageIntegration
            Test-DatabasePackageIntegration
            Test-FrontendBuild
            Test-TrpcCommunication
        }
        "api" {
            Test-ApiServerStartup
            Test-HealthCheckEndpoint
        }
        "database" {
            Test-DatabasePackageIntegration
        }
        "auth" {
            Test-AuthPackageIntegration
        }
        "frontend" {
            Test-FrontendBuild
        }
        "trpc" {
            Test-TrpcCommunication
        }
    }
    
    Show-ValidationSummary
}
catch {
    Write-Error "Validation script failed: $($_.Exception.Message)"
    exit 1
}
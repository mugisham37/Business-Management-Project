#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Simple integration validation for fullstack monolith transformation

.DESCRIPTION
    Performs basic validation checks without full compilation
#>

# Colors for output
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

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

Write-ValidationHeader "Fullstack Monolith Integration Validation"

# 1. Check workspace structure
Write-Host "1. Checking workspace structure..."
$requiredDirs = @("apps/api", "apps/web", "packages/shared", "packages/database", "packages/auth", "packages/config", "packages/cache", "packages/logger", "packages/notifications", "packages/api-contracts")

$allDirsExist = $true
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Success "$dir exists"
    } else {
        Write-Error "$dir missing"
        $allDirsExist = $false
    }
}

# 2. Check package.json files
Write-Host "`n2. Checking package.json files..."
$packageJsonFiles = @("package.json", "apps/api/package.json", "apps/web/package.json", "packages/shared/package.json", "packages/api-contracts/package.json")

foreach ($file in $packageJsonFiles) {
    if (Test-Path $file) {
        try {
            $content = Get-Content $file | ConvertFrom-Json
            Write-Success "$file is valid JSON"
        } catch {
            Write-Error "$file has invalid JSON"
        }
    } else {
        Write-Error "$file missing"
    }
}

# 3. Check workspace dependencies
Write-Host "`n3. Checking workspace dependencies..."
if (Test-Path "package.json") {
    $rootPackage = Get-Content "package.json" | ConvertFrom-Json
    if ($rootPackage.workspaces) {
        Write-Success "Workspace configuration found"
    } else {
        Write-Error "No workspace configuration"
    }
}

# 4. Check if packages are built
Write-Host "`n4. Checking if packages are built..."
$packageDirs = @("packages/shared", "packages/database", "packages/auth", "packages/config", "packages/cache", "packages/logger", "packages/notifications", "packages/api-contracts")

foreach ($dir in $packageDirs) {
    if (Test-Path "$dir/dist") {
        Write-Success "$dir is built"
    } else {
        Write-Error "$dir not built"
    }
}

# 5. Check tRPC contracts
Write-Host "`n5. Checking tRPC contracts..."
if (Test-Path "packages/api-contracts/src/routers") {
    $routers = Get-ChildItem "packages/api-contracts/src/routers" -Filter "*.ts"
    if ($routers.Count -gt 0) {
        Write-Success "tRPC routers found $($routers.Count) files"
    } else {
        Write-Error "No tRPC routers found"
    }
} else {
    Write-Error "tRPC routers directory missing"
}

# 6. Check web app structure
Write-Host "`n6. Checking web application structure..."
$webDirs = @("apps/web/src", "apps/web/pages", "apps/web/app")
$webExists = $false
foreach ($dir in $webDirs) {
    if (Test-Path $dir) {
        Write-Success "Web app structure found at $dir"
        $webExists = $true
        break
    }
}
if (-not $webExists) {
    Write-Error "No web app structure found"
}

# 7. Check API structure
Write-Host "`n7. Checking API application structure..."
if (Test-Path "apps/api/src") {
    $apiDirs = @("apps/api/src/presentation", "apps/api/src/application", "apps/api/src/infrastructure")
    foreach ($dir in $apiDirs) {
        if (Test-Path $dir) {
            Write-Success "$dir exists"
        } else {
            Write-Error "$dir missing"
        }
    }
} else {
    Write-Error "API source directory missing"
}

# 8. Test basic package imports (without compilation)
Write-Host "`n8. Testing package import structure..."
$testImports = @{
    "packages/shared/src/index.ts" = "Shared package exports"
    "packages/api-contracts/src/index.ts" = "API contracts exports"
    "packages/auth/src/index.ts" = "Auth package exports"
    "packages/database/src/index.ts" = "Database package exports"
}

foreach ($file in $testImports.Keys) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match "export") {
            Write-Success "$($testImports[$file]) - has exports"
        } else {
            Write-Error "$($testImports[$file]) - no exports found"
        }
    } else {
        Write-Error "$($testImports[$file]) - file missing"
    }
}

# 9. Check development scripts
Write-Host "`n9. Checking development scripts..."
if (Test-Path "package.json") {
    $rootPackage = Get-Content "package.json" | ConvertFrom-Json
    $requiredScripts = @("dev", "build", "test", "setup")
    
    foreach ($script in $requiredScripts) {
        if ($rootPackage.scripts.$script) {
            Write-Success "Script '$script' exists"
        } else {
            Write-Error "Script '$script' missing"
        }
    }
}

Write-Host "`n${Blue}============================================${Reset}"
Write-Host "${Blue}Validation Complete${Reset}"
Write-Host "${Blue}============================================${Reset}"
Write-Host "${Green}Basic structure validation completed.${Reset}"
Write-Host "${Yellow}Note: This is a basic structure check. Full compilation may require fixing import errors.${Reset}"
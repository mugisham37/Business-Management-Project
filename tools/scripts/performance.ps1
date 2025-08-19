# Performance monitoring and analysis scripts for Windows
param(
    [Parameter(Position=0)]
    [ValidateSet("analyze", "test", "monitor", "database", "report", "all", "help")]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [int]$Duration = 60
)

$ErrorActionPreference = "Continue"

# Get script directory and root directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to analyze bundle sizes
function Analyze-Bundles {
    Write-Info "Analyzing bundle sizes..."
    
    Set-Location $RootDir
    
    # Create analysis directory
    if (-not (Test-Path "bundle-analysis")) {
        New-Item -ItemType Directory -Path "bundle-analysis" -Force | Out-Null
    }
    
    # Analyze web app bundle
    if (Test-Path "apps/web") {
        Write-Info "Analyzing web app bundle..."
        Set-Location "apps/web"
        
        # Generate bundle analysis
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            $env:ANALYZE = "true"
            npm run build 2>&1 | Tee-Object -FilePath "../../bundle-analysis/web-bundle-analysis.log"
        } else {
            Write-Warning "npm not found, skipping web bundle analysis"
        }
        
        Set-Location $RootDir
    }
    
    # Analyze API bundle (if applicable)
    if (Test-Path "apps/api") {
        Write-Info "Analyzing API bundle..."
        Set-Location "apps/api"
        
        # Check bundle size
        if (Test-Path "dist") {
            $bundleSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum
            "$([math]::Round($bundleSize / 1MB, 2)) MB" | Out-File -FilePath "../../bundle-analysis/api-bundle-size.txt"
            
            Get-ChildItem -Path "dist" -Filter "*.js" -Recurse | 
                Select-Object Name, @{Name="Size";Expression={$_.Length}} | 
                Sort-Object Size -Descending | 
                Out-File -FilePath "../../bundle-analysis/api-file-sizes.txt"
        }
        
        Set-Location $RootDir
    }
    
    Write-Success "Bundle analysis complete. Results in bundle-analysis/"
}

# Function to run performance tests
function Run-PerformanceTests {
    Write-Info "Running performance tests..."
    
    Set-Location $RootDir
    
    # Create performance reports directory
    if (-not (Test-Path "performance-reports")) {
        New-Item -ItemType Directory -Path "performance-reports" -Force | Out-Null
    }
    
    # Check if API is running
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Info "API is running, performing tests..."
        
        # Simple performance test using PowerShell
        $testResults = @()
        for ($i = 1; $i -le 10; $i++) {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 10 | Out-Null
                $stopwatch.Stop()
                $testResults += $stopwatch.ElapsedMilliseconds
            } catch {
                Write-Warning "Request $i failed: $($_.Exception.Message)"
            }
        }
        
        if ($testResults.Count -gt 0) {
            $avgResponseTime = ($testResults | Measure-Object -Average).Average
            $maxResponseTime = ($testResults | Measure-Object -Maximum).Maximum
            $minResponseTime = ($testResults | Measure-Object -Minimum).Minimum
            
            @{
                "test" = "health_endpoint"
                "requests" = $testResults.Count
                "avg_response_time_ms" = $avgResponseTime
                "max_response_time_ms" = $maxResponseTime
                "min_response_time_ms" = $minResponseTime
                "timestamp" = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            } | ConvertTo-Json | Out-File -FilePath "performance-reports/api-health-perf.json"
        }
        
    } catch {
        Write-Warning "API not accessible at http://localhost:3001, skipping API performance tests"
    }
    
    Write-Success "Performance tests complete. Results in performance-reports/"
}

# Function to monitor system resources
function Monitor-Resources {
    param([int]$DurationSeconds = 60)
    
    Write-Info "Monitoring system resources for $DurationSeconds seconds..."
    
    Set-Location $RootDir
    if (-not (Test-Path "performance-reports")) {
        New-Item -ItemType Directory -Path "performance-reports" -Force | Out-Null
    }
    
    $results = @()
    $results += "timestamp,cpu_percent,memory_percent,available_memory_gb"
    
    for ($i = 1; $i -le $DurationSeconds; $i++) {
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        
        # Get CPU usage
        try {
            $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
            $cpuUsage = $cpu.Average
        } catch {
            $cpuUsage = "N/A"
        }
        
        # Get memory usage
        try {
            $os = Get-WmiObject -Class Win32_OperatingSystem
            $totalMemory = $os.TotalVisibleMemorySize
            $freeMemory = $os.FreePhysicalMemory
            $usedMemory = $totalMemory - $freeMemory
            $memoryPercent = [math]::Round(($usedMemory / $totalMemory) * 100, 2)
            $availableMemoryGB = [math]::Round($freeMemory / 1MB, 2)
        } catch {
            $memoryPercent = "N/A"
            $availableMemoryGB = "N/A"
        }
        
        $results += "$timestamp,$cpuUsage,$memoryPercent,$availableMemoryGB"
        
        if ($i -lt $DurationSeconds) {
            Start-Sleep -Seconds 1
        }
        
        if ($i % 10 -eq 0) {
            Write-Info "Monitoring progress: $i/$DurationSeconds seconds"
        }
    }
    
    $results | Out-File -FilePath "performance-reports/system-resources.csv" -Encoding UTF8
    
    Write-Success "Resource monitoring complete. Results in performance-reports/system-resources.csv"
}

# Function to analyze database performance
function Analyze-Database {
    Write-Info "Analyzing database performance..."
    
    Set-Location $RootDir
    if (-not (Test-Path "performance-reports")) {
        New-Item -ItemType Directory -Path "performance-reports" -Force | Out-Null
    }
    
    # Check if DATABASE_URL is set
    if ($env:DATABASE_URL) {
        Write-Info "DATABASE_URL found, attempting database analysis..."
        
        # Check if psql is available
        if (Get-Command psql -ErrorAction SilentlyContinue) {
            try {
                # Get database size
                psql $env:DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;" | Out-File -FilePath "performance-reports/database-size.txt"
                
                # Get table sizes
                psql $env:DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;" | Out-File -FilePath "performance-reports/table-sizes.txt"
                
                Write-Success "Database analysis complete"
            } catch {
                Write-Warning "Could not connect to database: $($_.Exception.Message)"
            }
        } else {
            Write-Warning "PostgreSQL client (psql) not available, skipping database analysis"
        }
    } else {
        Write-Warning "DATABASE_URL not set, skipping database analysis"
    }
}

# Function to generate performance report
function Generate-Report {
    Write-Info "Generating performance report..."
    
    Set-Location $RootDir
    
    $report = @"
# Performance Analysis Report
Generated on: $(Get-Date)

## System Information
- OS: $($env:OS)
- Architecture: $($env:PROCESSOR_ARCHITECTURE)
- Node.js Version: $(if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { 'Not available' })
- NPM Version: $(if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version } else { 'Not available' })

## Bundle Analysis
"@

    if (Test-Path "bundle-analysis/web-bundle-analysis.log") {
        $report += @"

### Web App Bundle
``````
$(Get-Content "bundle-analysis/web-bundle-analysis.log" -Tail 20 | Out-String)
``````

"@
    }

    if (Test-Path "bundle-analysis/api-bundle-size.txt") {
        $report += @"

### API Bundle Size
``````
$(Get-Content "bundle-analysis/api-bundle-size.txt" | Out-String)
``````

"@
    }

    $report += @"

## Performance Test Results
"@

    if (Test-Path "performance-reports/api-health-perf.json") {
        $report += @"

### API Health Endpoint Performance
``````json
$(Get-Content "performance-reports/api-health-perf.json" | Out-String)
``````

"@
    }

    $report += @"

## Database Performance
"@

    if (Test-Path "performance-reports/database-size.txt") {
        $report += @"

### Database Size
``````
$(Get-Content "performance-reports/database-size.txt" | Out-String)
``````

"@
    }

    if (Test-Path "performance-reports/table-sizes.txt") {
        $report += @"

### Table Sizes
``````
$(Get-Content "performance-reports/table-sizes.txt" | Out-String)
``````

"@
    }

    $report += @"

## Recommendations
- Monitor bundle sizes regularly to prevent bloat
- Optimize slow database queries identified above
- Consider implementing caching for frequently accessed data
- Set up continuous performance monitoring in production
"@

    $report | Out-File -FilePath "performance-reports/performance-report.md" -Encoding UTF8
    
    Write-Success "Performance report generated: performance-reports/performance-report.md"
}

# Main execution
switch ($Command) {
    "analyze" {
        Analyze-Bundles
    }
    "test" {
        Run-PerformanceTests
    }
    "monitor" {
        Monitor-Resources -DurationSeconds $Duration
    }
    "database" {
        Analyze-Database
    }
    "report" {
        Generate-Report
    }
    "all" {
        Analyze-Bundles
        Run-PerformanceTests
        Monitor-Resources -DurationSeconds 30
        Analyze-Database
        Generate-Report
    }
    default {
        Write-Host @"
Usage: .\performance.ps1 {analyze|test|monitor|database|report|all} [duration]

Commands:
  analyze   - Analyze bundle sizes
  test      - Run performance tests
  monitor   - Monitor system resources (default: 60 seconds)
  database  - Analyze database performance
  report    - Generate comprehensive performance report
  all       - Run all performance analysis tasks

Examples:
  .\performance.ps1 analyze
  .\performance.ps1 monitor 120
  .\performance.ps1 all
"@
    }
}
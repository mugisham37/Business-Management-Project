#!/bin/bash

# Performance monitoring and analysis scripts
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to analyze bundle sizes
analyze_bundles() {
    log_info "Analyzing bundle sizes..."
    
    cd "$ROOT_DIR"
    
    # Create analysis directory
    mkdir -p bundle-analysis
    
    # Analyze web app bundle
    if [ -d "apps/web" ]; then
        log_info "Analyzing web app bundle..."
        cd apps/web
        
        # Generate bundle analysis
        if command -v npx &> /dev/null; then
            ANALYZE=true npm run build 2>&1 | tee ../../bundle-analysis/web-bundle-analysis.log
        else
            log_warning "npx not found, skipping web bundle analysis"
        fi
        
        cd "$ROOT_DIR"
    fi
    
    # Analyze API bundle (if applicable)
    if [ -d "apps/api" ]; then
        log_info "Analyzing API bundle..."
        cd apps/api
        
        # Check bundle size
        if [ -d "dist" ]; then
            du -sh dist/ > ../../bundle-analysis/api-bundle-size.txt
            find dist/ -name "*.js" -exec wc -c {} + | sort -n > ../../bundle-analysis/api-file-sizes.txt
        fi
        
        cd "$ROOT_DIR"
    fi
    
    log_success "Bundle analysis complete. Results in bundle-analysis/"
}

# Function to run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    cd "$ROOT_DIR"
    
    # Create performance reports directory
    mkdir -p performance-reports
    
    # Run Lighthouse CI if available
    if command -v lhci &> /dev/null; then
        log_info "Running Lighthouse CI..."
        lhci autorun --config=.lighthouserc.json || log_warning "Lighthouse CI failed"
    else
        log_warning "Lighthouse CI not installed, skipping web performance tests"
    fi
    
    # Run API performance tests with autocannon if available
    if command -v autocannon &> /dev/null && pgrep -f "apps/api" > /dev/null; then
        log_info "Running API performance tests..."
        
        # Test health endpoint
        autocannon -c 10 -d 30 -j http://localhost:3001/health > performance-reports/api-health-perf.json || log_warning "API health test failed"
        
        # Test auth endpoint
        autocannon -c 10 -d 30 -j http://localhost:3001/api/auth/me > performance-reports/api-auth-perf.json || log_warning "API auth test failed"
    else
        log_warning "autocannon not installed or API not running, skipping API performance tests"
    fi
    
    log_success "Performance tests complete. Results in performance-reports/"
}

# Function to monitor system resources
monitor_resources() {
    local duration=${1:-60}
    log_info "Monitoring system resources for ${duration} seconds..."
    
    cd "$ROOT_DIR"
    mkdir -p performance-reports
    
    # Monitor CPU and memory usage
    {
        echo "timestamp,cpu_percent,memory_percent,load_avg"
        for i in $(seq 1 $duration); do
            timestamp=$(date '+%Y-%m-%d %H:%M:%S')
            
            # Get CPU usage (requires sysstat package)
            if command -v sar &> /dev/null; then
                cpu_usage=$(sar -u 1 1 | tail -1 | awk '{print 100-$8}')
            else
                cpu_usage="N/A"
            fi
            
            # Get memory usage
            if command -v free &> /dev/null; then
                memory_usage=$(free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}')
            else
                memory_usage="N/A"
            fi
            
            # Get load average
            if [ -f /proc/loadavg ]; then
                load_avg=$(cat /proc/loadavg | awk '{print $1}')
            else
                load_avg="N/A"
            fi
            
            echo "$timestamp,$cpu_usage,$memory_usage,$load_avg"
            sleep 1
        done
    } > performance-reports/system-resources.csv
    
    log_success "Resource monitoring complete. Results in performance-reports/system-resources.csv"
}

# Function to analyze database performance
analyze_database() {
    log_info "Analyzing database performance..."
    
    cd "$ROOT_DIR"
    mkdir -p performance-reports
    
    # Check if database is accessible
    if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
        log_info "Running database performance analysis..."
        
        # Get slow queries
        psql "$DATABASE_URL" -c "
            SELECT query, calls, total_time, mean_time, rows
            FROM pg_stat_statements
            ORDER BY total_time DESC
            LIMIT 10;
        " > performance-reports/slow-queries.txt 2>/dev/null || log_warning "Could not fetch slow queries"
        
        # Get database size
        psql "$DATABASE_URL" -c "
            SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
        " > performance-reports/database-size.txt 2>/dev/null || log_warning "Could not fetch database size"
        
        # Get table sizes
        psql "$DATABASE_URL" -c "
            SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
        " > performance-reports/table-sizes.txt 2>/dev/null || log_warning "Could not fetch table sizes"
        
        log_success "Database analysis complete"
    else
        log_warning "PostgreSQL client not available or DATABASE_URL not set, skipping database analysis"
    fi
}

# Function to generate performance report
generate_report() {
    log_info "Generating performance report..."
    
    cd "$ROOT_DIR"
    
    # Create comprehensive report
    {
        echo "# Performance Analysis Report"
        echo "Generated on: $(date)"
        echo ""
        
        echo "## System Information"
        echo "- OS: $(uname -s)"
        echo "- Architecture: $(uname -m)"
        echo "- Node.js Version: $(node --version 2>/dev/null || echo 'Not available')"
        echo "- NPM Version: $(npm --version 2>/dev/null || echo 'Not available')"
        echo ""
        
        echo "## Bundle Analysis"
        if [ -f "bundle-analysis/web-bundle-analysis.log" ]; then
            echo "### Web App Bundle"
            echo "\`\`\`"
            tail -20 bundle-analysis/web-bundle-analysis.log
            echo "\`\`\`"
            echo ""
        fi
        
        if [ -f "bundle-analysis/api-bundle-size.txt" ]; then
            echo "### API Bundle Size"
            echo "\`\`\`"
            cat bundle-analysis/api-bundle-size.txt
            echo "\`\`\`"
            echo ""
        fi
        
        echo "## Performance Test Results"
        if [ -f "performance-reports/api-health-perf.json" ]; then
            echo "### API Health Endpoint Performance"
            echo "\`\`\`json"
            cat performance-reports/api-health-perf.json | head -20
            echo "\`\`\`"
            echo ""
        fi
        
        echo "## Database Performance"
        if [ -f "performance-reports/database-size.txt" ]; then
            echo "### Database Size"
            echo "\`\`\`"
            cat performance-reports/database-size.txt
            echo "\`\`\`"
            echo ""
        fi
        
        if [ -f "performance-reports/slow-queries.txt" ]; then
            echo "### Slow Queries"
            echo "\`\`\`"
            cat performance-reports/slow-queries.txt
            echo "\`\`\`"
            echo ""
        fi
        
        echo "## Recommendations"
        echo "- Monitor bundle sizes regularly to prevent bloat"
        echo "- Optimize slow database queries identified above"
        echo "- Consider implementing caching for frequently accessed data"
        echo "- Set up continuous performance monitoring in production"
        
    } > performance-reports/performance-report.md
    
    log_success "Performance report generated: performance-reports/performance-report.md"
}

# Main function
main() {
    case "${1:-help}" in
        "analyze")
            analyze_bundles
            ;;
        "test")
            run_performance_tests
            ;;
        "monitor")
            monitor_resources "${2:-60}"
            ;;
        "database")
            analyze_database
            ;;
        "report")
            generate_report
            ;;
        "all")
            analyze_bundles
            run_performance_tests
            monitor_resources 30
            analyze_database
            generate_report
            ;;
        "help"|*)
            echo "Usage: $0 {analyze|test|monitor|database|report|all}"
            echo ""
            echo "Commands:"
            echo "  analyze   - Analyze bundle sizes"
            echo "  test      - Run performance tests"
            echo "  monitor   - Monitor system resources (default: 60 seconds)"
            echo "  database  - Analyze database performance"
            echo "  report    - Generate comprehensive performance report"
            echo "  all       - Run all performance analysis tasks"
            echo ""
            echo "Examples:"
            echo "  $0 analyze"
            echo "  $0 monitor 120"
            echo "  $0 all"
            ;;
    esac
}

main "$@"
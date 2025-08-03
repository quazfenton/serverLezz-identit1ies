#!/bin/bash

# Advanced LLM Orchestrator Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Example: ./deploy.sh production start

set -e

# Configuration
ENVIRONMENT=${1:-production}
ACTION=${2:-start}
APP_NAME="advanced-llm-orchestrator"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check PM2 for production
    if [[ "$ENVIRONMENT" == "production" ]] && ! command -v pm2 &> /dev/null; then
        log_warning "PM2 is not installed. Installing PM2..."
        npm install -g pm2
    fi
    
    # Check Docker if using Docker deployment
    if [[ "$ACTION" == "docker" ]] && ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$SCRIPT_DIR"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        npm ci --only=production
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    cd "$SCRIPT_DIR"
    
    # Clean previous build
    npm run clean
    
    # Build TypeScript
    npm run build
    
    log_success "Application built successfully"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment for $ENVIRONMENT..."
    
    cd "$SCRIPT_DIR"
    
    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            log_warning ".env file not found. Copying from .env.example"
            cp .env.example .env
            log_warning "Please edit .env file with your configuration"
        else
            log_error ".env.example file not found"
            exit 1
        fi
    fi
    
    # Create necessary directories
    mkdir -p logs data
    
    log_success "Environment setup completed"
}

# Start application
start_application() {
    log_info "Starting application in $ENVIRONMENT mode..."
    
    cd "$SCRIPT_DIR"
    
    case $ENVIRONMENT in
        "development")
            npm run dev
            ;;
        "production")
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.config.js --env production
                log_success "Application started with PM2"
                pm2 save
            else
                npm start
            fi
            ;;
        "staging")
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.config.js --env staging
                log_success "Application started with PM2 in staging mode"
            else
                NODE_ENV=staging npm start
            fi
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Stop application
stop_application() {
    log_info "Stopping application..."
    
    if command -v pm2 &> /dev/null; then
        pm2 stop ecosystem.config.js 2>/dev/null || true
        log_success "Application stopped"
    else
        log_warning "PM2 not found. Please stop the application manually"
    fi
}

# Restart application
restart_application() {
    log_info "Restarting application..."
    
    if command -v pm2 &> /dev/null; then
        pm2 restart ecosystem.config.js --env $ENVIRONMENT
        log_success "Application restarted"
    else
        log_error "PM2 not found. Cannot restart application"
        exit 1
    fi
}

# Deploy with Docker
deploy_docker() {
    log_info "Deploying with Docker..."
    
    cd "$SCRIPT_DIR"
    
    # Build Docker image
    docker build -t $APP_NAME:latest .
    
    # Stop existing container
    docker stop $APP_NAME 2>/dev/null || true
    docker rm $APP_NAME 2>/dev/null || true
    
    # Run new container
    docker run -d \
        --name $APP_NAME \
        -p 3000:3000 \
        --env-file .env \
        --restart unless-stopped \
        -v "$(pwd)/logs:/app/logs" \
        -v "$(pwd)/data:/app/data" \
        $APP_NAME:latest
    
    log_success "Docker deployment completed"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    cd "$SCRIPT_DIR"
    
    # Stop existing services
    docker-compose down
    
    # Build and start services
    docker-compose up -d --build
    
    log_success "Docker Compose deployment completed"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    local url="http://localhost:3000/health"
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed. Retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Show status
show_status() {
    log_info "Application status:"
    
    if command -v pm2 &> /dev/null; then
        pm2 list
        echo
        pm2 monit --no-interaction || true
    else
        log_warning "PM2 not found. Cannot show detailed status"
    fi
    
    # Check if application is responding
    if curl -f -s "http://localhost:3000/health" > /dev/null 2>&1; then
        log_success "Application is responding"
    else
        log_warning "Application is not responding"
    fi
}

# Show logs
show_logs() {
    log_info "Showing application logs..."
    
    if command -v pm2 &> /dev/null; then
        pm2 logs --lines 50
    else
        if [[ -f "logs/combined.log" ]]; then
            tail -f logs/combined.log
        else
            log_warning "No log files found"
        fi
    fi
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    
    # Stop application
    stop_application
    
    # Clean build artifacts
    npm run clean 2>/dev/null || true
    
    # Remove PM2 processes
    if command -v pm2 &> /dev/null; then
        pm2 delete ecosystem.config.js 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Main deployment function
deploy() {
    log_info "Starting deployment for $ENVIRONMENT environment..."
    
    check_prerequisites
    setup_environment
    install_dependencies
    build_application
    
    case $ACTION in
        "start")
            start_application
            sleep 5
            health_check
            ;;
        "stop")
            stop_application
            ;;
        "restart")
            restart_application
            sleep 5
            health_check
            ;;
        "docker")
            deploy_docker
            sleep 10
            health_check
            ;;
        "docker-compose")
            deploy_docker_compose
            sleep 15
            health_check
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            log_error "Unknown action: $ACTION"
            echo "Available actions: start, stop, restart, docker, docker-compose, status, logs, cleanup"
            exit 1
            ;;
    esac
    
    log_success "Deployment completed successfully!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [environment] [action]"
    echo
    echo "Environments:"
    echo "  development  - Development environment"
    echo "  staging      - Staging environment"
    echo "  production   - Production environment (default)"
    echo
    echo "Actions:"
    echo "  start        - Start the application (default)"
    echo "  stop         - Stop the application"
    echo "  restart      - Restart the application"
    echo "  docker       - Deploy with Docker"
    echo "  docker-compose - Deploy with Docker Compose"
    echo "  status       - Show application status"
    echo "  logs         - Show application logs"
    echo "  cleanup      - Clean up and stop everything"
    echo
    echo "Examples:"
    echo "  $0 production start"
    echo "  $0 development"
    echo "  $0 production docker"
    echo "  $0 production status"
}

# Main execution
main() {
    case ${1:-} in
        "-h"|"--help"|"help")
            show_usage
            exit 0
            ;;
        *)
            deploy
            ;;
    esac
}

# Run main function
main "$@"
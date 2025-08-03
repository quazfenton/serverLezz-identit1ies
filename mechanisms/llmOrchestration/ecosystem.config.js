module.exports = {
  apps: [
    {
      name: 'llm-orchestrator',
      script: './dist/server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        ENABLE_WEBSOCKET: 'true',
        ENABLE_CORS: 'true',
        ENABLE_RATE_LIMIT: 'true',
        MAX_REQUESTS_PER_MINUTE: '100',
        
        // LLM Provider API Keys (set these in your environment)
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        
        // Optional: Custom endpoints
        OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
        ANTHROPIC_ENDPOINT: 'https://api.anthropic.com/v1/messages',
        GOOGLE_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        
        // Security
        ALLOWED_ORIGINS: 'http://localhost:3000,https://yourdomain.com',
        
        // Monitoring
        ENABLE_METRICS: 'true',
        METRICS_INTERVAL: '30',
        
        // Evolution settings
        ENABLE_EVOLUTION: 'true',
        EVOLUTION_INTERVAL: '60',
        
        // Cache settings
        CACHE_TTL: '300',
        CACHE_MAX_SIZE: '1000'
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        ENABLE_METRICS: 'true',
        METRICS_INTERVAL: '10'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3002,
        MAX_REQUESTS_PER_MINUTE: '50'
      },
      
      // PM2 Configuration
      watch: false, // Set to true for development
      ignore_watch: ['node_modules', 'logs', 'data'],
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Memory management
      max_memory_restart: '1G',
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Advanced settings
      node_args: '--max-old-space-size=2048',
      merge_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Auto restart on file changes (development only)
      watch_options: {
        followSymlinks: false,
        usePolling: false
      }
    },
    
    // Worker process for background tasks
    {
      name: 'llm-orchestrator-worker',
      script: './dist/worker.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'background',
        ENABLE_EVOLUTION: 'true',
        ENABLE_ANALYTICS: 'true',
        ENABLE_CLEANUP: 'true'
      },
      
      // Worker-specific settings
      cron_restart: '0 2 * * *', // Restart daily at 2 AM
      max_memory_restart: '512M',
      
      // Logging
      log_file: './logs/worker-combined.log',
      out_file: './logs/worker-out.log',
      error_file: './logs/worker-error.log'
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/llm-orchestrator.git',
      path: '/var/www/llm-orchestrator',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    },
    
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/llm-orchestrator.git',
      path: '/var/www/llm-orchestrator-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging'
    }
  }
};
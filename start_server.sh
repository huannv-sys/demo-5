#!/bin/bash
# Ensure environment variables are set correctly
export USE_REAL_MIKROTIK_API=true
export SESSION_SECRET=mikrotik-dashboard-secret

# Start the server
nohup npx tsx server/index.ts > server.log 2>&1 &
echo $! > server.pid
echo "Server started with PID $(cat server.pid)"

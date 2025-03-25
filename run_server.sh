#!/bin/bash
export USE_REAL_MIKROTIK_API=true
export SESSION_SECRET=mikrotik-dashboard-secret

# Chạy server
npx tsx server/index.ts
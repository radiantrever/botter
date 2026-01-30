// This file is kept for backward compatibility
// The actual health check is now in src/health-check.ts

// Import and run the TypeScript health check
const { spawn } = require('child_process');

// Run ts-node to execute the health check
const child = spawn('npx', ['ts-node', 'src/health-check.ts'], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  process.exit(code);
});
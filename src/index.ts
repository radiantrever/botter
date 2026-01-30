import { startBot } from './bot/bot';
import prisma from './db/prisma';
import express, { Request, Response } from 'express';
import healthCheck from './health-check';
import { Redis } from 'ioredis';
import { createServer } from 'http';

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    // Initialize Redis for health check if available
    let redis: Redis | null = null;
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    }

    // Create Express app for health check endpoint
    const app = express();

    // Health check endpoint
    app.get('/health', async (req: Request, res: Response) => {
      const result = await healthCheck();
      const status = result.status === 'healthy' ? 200 : 503;
      res.status(status).json(result);
    });

    // Simple status endpoint
    app.get('/status', (req: Request, res: Response) => {
      res.json({
        status: 'running',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // Start server for health checks
    const port = parseInt(process.env.PORT || '3000');
    const server = createServer(app);

    // Start expiration checker (fail-safe cron)
    const { startExpirationCron } = require('./workers/expiration');
    startExpirationCron();

    // Start bot
    await startBot();

    // Start HTTP server for health checks
    server.listen(port + 1, () => {
      console.log(`Health check server running on port ${port + 1}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully');
      server.close(() => {
        console.log('HTTP server closed');
        if (redis) {
          redis.quit();
        }
        process.exit(0);
      });
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();

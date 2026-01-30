import prisma from './db/prisma';
import { Redis } from 'ioredis';

// Initialize Redis connection for health check
let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'ok' | 'failed';
    redis?: 'ok' | 'failed';
    application: 'ok' | 'failed';
  };
  uptime?: number;
  version?: string;
}

async function healthCheck(): Promise<HealthCheckResponse> {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    const healthCheck: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
        application: 'ok',
      },
    };

    // Check Redis connectivity if configured
    if (redis) {
      try {
        await redis.ping();
        healthCheck.services.redis = 'ok';
      } catch (_redisError) {
        healthCheck.services.redis = 'failed';
        healthCheck.status = 'unhealthy';
      }
    }

    // Add additional metrics
    healthCheck.uptime = process.uptime ? process.uptime() : 0;
    healthCheck.version = process.env.npm_package_version || 'unknown';

    return healthCheck;
  } catch (_error) {
    const healthCheck: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'failed',
        application: 'failed',
      },
      uptime: process.uptime ? process.uptime() : 0,
      version: process.env.npm_package_version || 'unknown',
    };

    if (redis) {
      healthCheck.services.redis = 'failed';
    }

    return healthCheck;
  }
}

// If this file is run directly, perform health check and exit appropriately
if (require.main === module) {
  healthCheck()
    .then(result => {
      if (result.status === 'healthy') {
        console.log('Health check: PASS');
        process.exit(0);
      } else {
        console.log('Health check: FAIL');
        console.log(JSON.stringify(result, null, 2));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Health check error:', error);
      process.exit(1);
    });
}

export default healthCheck;

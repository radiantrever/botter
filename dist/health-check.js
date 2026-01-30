"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./db/prisma"));
const ioredis_1 = require("ioredis");
// Initialize Redis connection for health check
let redis = null;
if (process.env.REDIS_URL) {
    redis = new ioredis_1.Redis(process.env.REDIS_URL);
}
async function healthCheck() {
    try {
        // Check database connectivity
        await prisma_1.default.$queryRaw `SELECT 1`;
        const healthCheck = {
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
            }
            catch (redisError) {
                healthCheck.services.redis = 'failed';
                healthCheck.status = 'unhealthy';
            }
        }
        // Add additional metrics
        healthCheck.uptime = process.uptime ? process.uptime() : 0;
        healthCheck.version = process.env.npm_package_version || 'unknown';
        return healthCheck;
    }
    catch (error) {
        const healthCheck = {
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
        }
        else {
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
exports.default = healthCheck;

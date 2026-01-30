"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bot_1 = require("./bot/bot");
const prisma_1 = __importDefault(require("./db/prisma"));
const express_1 = __importDefault(require("express"));
const health_check_1 = __importDefault(require("./health-check"));
const ioredis_1 = require("ioredis");
const http_1 = require("http");
async function main() {
    try {
        await prisma_1.default.$connect();
        console.log('Database connected');
        // Initialize Redis for health check if available
        let redis = null;
        if (process.env.REDIS_URL) {
            redis = new ioredis_1.Redis(process.env.REDIS_URL);
        }
        // Create Express app for health check endpoint
        const app = (0, express_1.default)();
        // Health check endpoint
        app.get('/health', async (req, res) => {
            const result = await (0, health_check_1.default)();
            const status = result.status === 'healthy' ? 200 : 503;
            res.status(status).json(result);
        });
        // Simple status endpoint
        app.get('/status', (req, res) => {
            res.json({
                status: 'running',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });
        // Start server for health checks
        const port = parseInt(process.env.PORT || '3000');
        const server = (0, http_1.createServer)(app);
        // Start expiration checker (fail-safe cron)
        const { startExpirationCron } = require('./workers/expiration');
        startExpirationCron();
        // Start bot
        await (0, bot_1.startBot)();
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
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();

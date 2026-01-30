# 🛠️ Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Telegram Paywall Platform.

## 📋 Table of Contents

- [Bot Issues](#bot-issues)
- [Database Problems](#database-problems)
- [Payment Integration Issues](#payment-integration-issues)
- [Deployment Problems](#deployment-problems)
- [Performance Issues](#performance-issues)
- [Security Concerns](#security-concerns)
- [Logging and Monitoring](#logging-and-monitoring)

## 🤖 Bot Issues

### Bot Not Responding

**Symptoms:**
- Bot doesn't reply to commands
- No webhook or polling activity
- Messages are not being processed

**Diagnosis:**
```bash
# Check if bot token is valid
curl -X GET "https://api.telegram.org/bot$BOT_TOKEN/getMe"

# Check bot logs
docker-compose logs app
# or
tail -f /var/log/botter/app.log

# Verify environment variables
echo $BOT_TOKEN
```

**Solutions:**
1. **Verify Bot Token**
   ```bash
   # Test token validity
   curl -X GET "https://api.telegram.org/botYOUR_TOKEN/getMe"
   # Should return bot information
   ```

2. **Check Network Connectivity**
   ```bash
   # Test Telegram API access
   ping api.telegram.org
   curl -I https://api.telegram.org
   ```

3. **Restart Bot Service**
   ```bash
   # Docker
   docker-compose restart app
   
   # Systemd
   sudo systemctl restart botter
   ```

4. **Clear Webhook (if using)**
   ```bash
   curl -X GET "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"
   ```

### Commands Not Working

**Symptoms:**
- Specific commands return errors
- Command responses are unexpected
- Menu buttons not functioning

**Diagnosis:**
```bash
# Check command handlers
grep -r "composer.command" src/bot/handlers/

# Check for TypeScript compilation errors
npm run build
```

**Solutions:**
1. **Update Dependencies**
   ```bash
   npm install
   npm run build
   ```

2. **Clear Session Data**
   ```bash
   # If using Redis for sessions
   redis-cli FLUSHALL
   ```

3. **Check Command Registration**
   ```typescript
   // Verify commands are registered in bot.ts
   console.log('Registered commands:', bot.commands);
   ```

### Deep Links Not Working

**Symptoms:**
- Generated links don't open the bot
- Start parameter not received
- Wrong channel loaded

**Solutions:**
1. **Verify Link Format**
   ```bash
   # Correct format
   https://t.me/YourBotUsername?start=c_CHANNELID
   ```

2. **Check Start Parameter Handling**
   ```typescript
   // In subscriber.ts handler
   composer.command('start', async (ctx) => {
     const payload = ctx.match; // Should contain "c_123"
     console.log('Start payload:', payload);
   });
   ```

3. **Test Link Generation**
   ```bash
   # Manual test
   curl -G "https://api.telegram.org/bot$BOT_TOKEN/getMe" \
        --data-urlencode "start=c_123"
   ```

## 🗄️ Database Problems

### Connection Issues

**Symptoms:**
- "Connection refused" errors
- Database timeout errors
- "Database not available" messages

**Diagnosis:**
```bash
# Check database service status
docker-compose ps db
# or
systemctl status postgresql

# Test connection
pg_isready -h localhost -p 5432
# or
docker-compose exec db pg_isready

# Check connection string
echo $DATABASE_URL
```

**Solutions:**
1. **Verify Database Service**
   ```bash
   # Docker
   docker-compose up -d db
   docker-compose logs db
   
   # System
   sudo systemctl start postgresql
   sudo systemctl status postgresql
   ```

2. **Check Connection Parameters**
   ```bash
   # Test connection manually
   psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Restart Database Connection**
   ```bash
   # In application
   npm restart
   # or restart the service
   ```

### Migration Problems

**Symptoms:**
- "Table doesn't exist" errors
- Migration failed messages
- Schema mismatch errors

**Solutions:**
1. **Check Migration Status**
   ```bash
   npx prisma migrate status
   ```

2. **Reset and Reapply Migrations**
   ```bash
   # Backup first!
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   
   # Reset database
   npx prisma migrate reset
   
   # Or create fresh migration
   npx prisma migrate dev --name fresh_start
   ```

3. **Manual Migration Fix**
   ```bash
   # Check for pending migrations
   npx prisma migrate resolve --applied "migration_name"
   ```

### Performance Issues

**Symptoms:**
- Slow query responses
- Database connection pool exhaustion
- High memory usage

**Solutions:**
1. **Optimize Queries**
   ```bash
   # Check slow queries
   psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   ```

2. **Connection Pool Configuration**
   ```env
   # In .env
   DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
   ```

3. **Add Indexes**
   ```sql
   -- Check for missing indexes
   SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
   ```

## 💰 Payment Integration Issues

### TsPay API Connection Failed

**Symptoms:**
- "TSPAY_SHOP_TOKEN is missing" errors
- Payment creation fails
- Transaction check timeouts

**Diagnosis:**
```bash
# Check environment variables
echo $TSPAY_SHOP_TOKEN

# Test API connectivity
curl -X GET "https://tspay.uz/api/v1/health" \
     -H "Authorization: Bearer $TSPAY_SHOP_TOKEN"

# Check logs
tail -f /var/log/botter/payment.log
```

**Solutions:**
1. **Verify Token**
   ```bash
   # Test token validity
   curl -X POST "https://tspay.uz/api/v1/auth/check" \
        -H "Content-Type: application/json" \
        -d '{"access_token": "'$TSPAY_SHOP_TOKEN'"}'
   ```

2. **Check TsPay Account**
   - Verify shop is active
   - Check API limits
   - Confirm webhook URLs

3. **Debug Payment Flow**
   ```typescript
   // Add detailed logging in tspay.ts
   console.log('TsPay Request:', {
     amount,
     redirectUrl,
     accessToken: accessToken.substring(0, 10) + '...' // Don't log full token
   });
   ```

### Payment Verification Failures

**Symptoms:**
- Paid transactions showing as unpaid
- Verification timing issues
- Duplicate payment processing

**Solutions:**
1. **Check Transaction Status**
   ```bash
   # Manual verification
   curl -X GET "https://tspay.uz/api/v1/transactions/CHEQUE_ID" \
        -H "Authorization: Bearer $TSPAY_SHOP_TOKEN"
   ```

2. **Add Retry Logic**
   ```typescript
   async function verifyPaymentWithRetry(transactionId: string, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const result = await tspay.checkTransaction(transactionId);
         if (result.status === 'success') return result;
         await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
       } catch (error) {
         if (i === maxRetries - 1) throw error;
       }
     }
   }
   ```

3. **Implement Payment Logging**
   ```sql
   -- Add payment verification log table
   CREATE TABLE payment_verifications (
     id SERIAL PRIMARY KEY,
     transaction_id VARCHAR(255),
     user_id BIGINT,
     status VARCHAR(50),
     attempt_count INTEGER,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

## 🚀 Deployment Problems

### Docker Deployment Issues

**Symptoms:**
- Container fails to start
- Port conflicts
- Volume mount errors
- Missing environment variables

**Solutions:**
1. **Check Container Logs**
   ```bash
   docker-compose logs app
   docker logs botter_app
   ```

2. **Verify Environment Variables**
   ```bash
   # Check loaded env vars
   docker-compose exec app env | grep DATABASE
   
   # Check env file
   cat .env
   ```

3. **Network Issues**
   ```bash
   # Check network connectivity between containers
   docker-compose exec app ping db
   docker-compose exec app telnet db 5432
   ```

### Port Already in Use

**Symptoms:**
- "Port already allocated" errors
- Service fails to bind

**Solutions:**
```bash
# Check which process uses the port
sudo netstat -tlnp | grep :3000
# or
sudo lsof -i :3000

# Kill conflicting process
sudo kill -9 $(sudo lsof -t -i:3000)

# Or change port in .env
echo "PORT=3001" >> .env
```

### SSL/HTTPS Issues

**Symptoms:**
- Certificate errors
- SSL handshake failures
- Mixed content warnings

**Solutions:**
```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout

# Renew certificate
sudo certbot renew

# Check Nginx configuration
sudo nginx -t
sudo systemctl reload nginx
```

## 🐢 Performance Issues

### High CPU Usage

**Symptoms:**
- Slow bot responses
- High system load
- Memory leaks

**Diagnostics:**
```bash
# Check resource usage
docker stats
top -p $(pgrep -f "node.*src/index")

# Profile Node.js application
node --inspect app.js
```

**Solutions:**
1. **Optimize Database Queries**
   ```bash
   # Find slow queries
   psql $DATABASE_URL -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"
   
   # Add appropriate indexes
   CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
   ```

2. **Implement Caching**
   ```typescript
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   
   async function getCachedChannel(id: number) {
     const cacheKey = `channel:${id}`;
     const cached = await redis.get(cacheKey);
     if (cached) return JSON.parse(cached);
     
     const channel = await prisma.channel.findUnique({ where: { id } });
     await redis.setex(cacheKey, 300, JSON.stringify(channel)); // 5 min cache
     return channel;
   }
   ```

3. **Add Rate Limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/api/', limiter);
   ```

### Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Application crashes with OOM errors
- Garbage collection issues

**Solutions:**
```bash
# Monitor memory usage
watch -n 1 'ps aux | grep "node.*src/index"'

# Generate heap dump
node --inspect --heap-prof app.js

# Check for memory leaks in code
# - Avoid global variables
# - Clear intervals/timeouts
# - Close database connections properly
```

## 🔐 Security Concerns

### Unauthorized Access

**Symptoms:**
- Suspicious user registrations
- Unauthorized channel additions
- Payment fraud attempts

**Solutions:**
1. **Implement Rate Limiting**
   ```typescript
   // Add to bot middleware
   const rateLimiter = new Map();
   
   bot.use(async (ctx, next) => {
     const userId = ctx.from?.id;
     if (!userId) return next();
     
     const now = Date.now();
     const userLimit = rateLimiter.get(userId) || { count: 0, resetTime: now + 60000 };
     
     if (now > userLimit.resetTime) {
       userLimit.count = 0;
       userLimit.resetTime = now + 60000;
     }
     
     if (userLimit.count >= 10) {
       return ctx.reply("Too many requests. Please try again later.");
     }
     
     userLimit.count++;
     rateLimiter.set(userId, userLimit);
     return next();
   });
   ```

2. **Add Input Validation**
   ```typescript
   import { z } from 'zod';
   
   const channelIdSchema = z.string().regex(/^c_\d+$/);
   
   composer.command('start', async (ctx) => {
     try {
       const payload = ctx.match;
       if (payload) {
         channelIdSchema.parse(payload);
       }
       // Process valid payload
     } catch (error) {
       ctx.reply("Invalid link format.");
     }
   });
   ```

3. **Monitor Suspicious Activity**
   ```sql
   -- Create audit log table
   CREATE TABLE security_logs (
     id SERIAL PRIMARY KEY,
     user_id BIGINT,
     action VARCHAR(100),
     ip_address INET,
     user_agent TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Log suspicious activities
   INSERT INTO security_logs (user_id, action, ip_address, user_agent)
   VALUES ($1, 'MULTIPLE_FAILED_PAYMENTS', $2, $3);
   ```

## 📝 Logging and Monitoring

### Missing Logs

**Symptoms:**
- No error information
- Difficulty debugging issues
- Missing audit trails

**Solutions:**
1. **Enhance Logging Configuration**
   ```typescript
   // src/core/logger.service.ts
   import winston from 'winston';
   
   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.errors({ stack: true }),
       winston.format.json()
     ),
     transports: [
       new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
       new winston.transports.File({ filename: 'logs/combined.log' }),
       new winston.transports.Console({
         format: winston.format.simple()
       })
     ]
   });
   
   export default logger;
   ```

2. **Add Structured Logging**
   ```typescript
   // Log with context
   logger.info('Payment processed', {
     userId: ctx.from?.id,
     amount: plan.price,
     transactionId: txId,
     channelId: plan.channelId
   });
   ```

3. **Centralized Logging**
   ```bash
   # Set up ELK stack or similar
   docker-compose -f docker-compose.logging.yml up -d
   ```

### Monitoring Setup

```bash
# Install monitoring tools
sudo apt install prometheus node-exporter grafana

# Configure Prometheus
cat > /etc/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'botter'
    static_configs:
      - targets: ['localhost:3000']
EOF

# Start monitoring
sudo systemctl start prometheus grafana-server
```

## 🆘 Emergency Procedures

### Complete System Recovery

1. **Immediate Actions**
   ```bash
   # Stop all services
   docker-compose down
   sudo systemctl stop botter
   
   # Check system resources
   df -h
   free -m
   ```

2. **Database Recovery**
   ```bash
   # Restore from latest backup
   gunzip backup_20240101.sql.gz
   psql $DATABASE_URL < backup_20240101.sql
   
   # Verify data integrity
   npx prisma studio
   ```

3. **Service Restart**
   ```bash
   # Start services in order
   docker-compose up -d db redis
   sleep 10
   docker-compose up -d app
   ```

### Contact Support

If you cannot resolve an issue:

1. **Gather Information:**
   - Error messages and logs
   - System specifications
   - Steps to reproduce
   - Environment details

2. **Create Issue Report:**
   ```markdown
   ## Issue Report
   
   **Environment:** [Production/Staging/Development]
   **Version:** [Git commit hash]
   **Error Message:** [Exact error text]
   **Steps to Reproduce:** [Detailed steps]
   **Expected Behavior:** [What should happen]
   **Actual Behavior:** [What actually happens]
   **Logs:** [Relevant log entries]
   ```

---

*Last updated: January 2026*
*For urgent issues, contact the development team immediately.*
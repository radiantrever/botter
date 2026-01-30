# Load Balancing and Scalability Configuration

## Overview

This document describes the load balancing and scalability patterns for the
Telegram Paywall Platform.

## Architecture Considerations

### State Management

The application uses Redis for:

- Session storage
- Rate limiting
- Caching
- Background job queues

### Horizontal Scaling

The application can be scaled horizontally since it's designed as a stateless
service with external state management (Redis, PostgreSQL).

## Load Balancer Configuration

### Nginx Load Balancer

```nginx
# Upstream servers configuration
upstream botter_backend {
    least_conn;
    
    # Server instances - adjust based on your infrastructure
    server app1.internal:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app2.internal:3000 weight=1 max_fails=3 fail_timeout=30s;
    server app3.internal:3000 weight=1 max_fails=3 fail_timeout=30s;
    
    # Health checks
    keepalive 32;
}

# Main server configuration
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Client settings
    client_max_body_size 10M;
    
    # Proxy settings for load balancing
    location / {
        proxy_pass http://botter_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings for performance
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://botter_backend;
        
        # Allow internal access only
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
    }
    
    # Specific handling for webhook endpoints
    location /webhook {
        proxy_pass http://botter_backend;
        
        # Increase timeout for webhook processing
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Disable buffering for streaming
        proxy_buffering off;
    }
}
```

### HAProxy Configuration (Alternative)

```haproxy
global
    daemon
    maxconn 4096
    pidfile /var/run/haproxy.pid

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httpchk GET /health
    balance roundrobin

frontend botter_frontend
    bind *:80
    bind *:443 ssl crt /path/to/certificate.pem
    default_backend botter_backend
    option forwardfor
    http-response set-header X-Forwarded-Proto https if { ssl_fc }
    acl letsencrypt_acl path_beg /.well-known/acme-challenge/
    redirect scheme https if !letsencrypt_acl !{ ssl_fc }

backend botter_backend
    option httplog
    server app1 app1.internal:3000 check
    server app2 app2.internal:3000 check
    server app3 app3.internal:3000 check
```

## Scaling Strategies

### Vertical Scaling

- Increase CPU and RAM on application servers
- Upgrade database hardware
- Increase Redis memory allocation

### Horizontal Scaling

- Add more application server instances
- Implement database read replicas
- Use Redis clustering

## Auto-Scaling Configuration

### Kubernetes Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: botter-app-hpa
  namespace: botter
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: botter-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
```

### Database Scaling

#### PostgreSQL Read Replicas

```yaml
# PostgreSQL with replication
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: botter-db-cluster
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  storage:
    size: 20Gi
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
```

## Rate Limiting Configuration

### Per-IP Rate Limiting

```nginx
# Define rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=webhook:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=general:10m rate=5r/s;

server {
    # Apply rate limiting to API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://botter_backend;
    }
    
    # Less restrictive for webhook (Telegram traffic)
    location /webhook {
        limit_req zone=webhook burst=200 nodelay;
        proxy_pass http://botter_backend;
    }
    
    # General rate limiting for other paths
    location / {
        limit_req zone=general burst=10 nodelay;
        proxy_pass http://botter_backend;
    }
}
```

## Health Checks

### Application Health Check Endpoint

```typescript
// src/routes/health.ts
import express from "express";
import prisma from "../db/prisma";
import Redis from "ioredis";

const router = express.Router();
const redis = new Redis(process.env.REDIS_URL);

router.get("/health", async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connectivity
    await redis.ping();

    // Check basic application functionality
    const uptime = process.uptime();

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: uptime,
      services: {
        database: "ok",
        redis: "ok",
        application: "ok",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: "failed",
        redis: "failed",
        application: "failed",
      },
    });
  }
});

export default router;
```

## Monitoring and Metrics

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "botter-app"
    static_configs:
      - targets: [
          "app1.internal:3000",
          "app2.internal:3000",
          "app3.internal:3000",
        ]
    scrape_interval: 15s

  - job_name: "nginx"
    static_configs:
      - targets: ["nginx.internal:9113"]
    scrape_interval: 15s
```

### Key Metrics to Monitor

- Response time percentiles (p50, p95, p99)
- Error rates
- Throughput (requests per second)
- Resource utilization (CPU, memory, disk)
- Database connection pool usage
- Redis memory usage
- Queue depths for background jobs

## Traffic Distribution Patterns

### Geographic Load Balancing

For global deployment, consider using a CDN or DNS-based geographic routing:

- Route users to the nearest regional cluster
- Maintain session affinity where needed
- Handle failover between regions

### Circuit Breaker Pattern

Implement circuit breakers to prevent cascading failures:

- When downstream services fail, temporarily stop requests
- Gradually resume requests when service recovers
- Monitor failure rates and response times

## Best Practices

1. **Graceful Degradation**: The system should continue operating with reduced
   functionality if certain components fail.

2. **Circuit Breakers**: Implement circuit breakers for external API calls
   (Telegram, payment providers).

3. **Connection Pooling**: Properly configure database and Redis connection
   pools.

4. **Health Checks**: Implement comprehensive health checks for all services.

5. **Monitoring**: Monitor all key metrics and set up appropriate alerting.

6. **Load Testing**: Regularly perform load testing to validate scaling
   assumptions.

7. **Blue-Green Deployments**: Use blue-green or canary deployments to minimize
   downtime during releases.

---

_Last updated: January 2026_

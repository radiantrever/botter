# 🚀 Deployment Guide

This guide covers various deployment scenarios for the Telegram Paywall
Platform, from local development to production environments.

## 📋 Table of Contents

- [Local Development Setup](#local-development-setup)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Provider Deployment](#cloud-provider-deployment)
- [Backup and Recovery](#backup-and-recovery)
- [Monitoring and Scaling](#monitoring-and-scaling)

## 🛠️ Local Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/botter.git
cd botter

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start development services
docker-compose up -d

# Run database migrations
npx prisma migrate dev --name init
npx prisma generate

# Start development server
npm run dev
```

### Environment Configuration

Create `.env` file with:

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
LOG_CHANNEL_ID=-1001234567890

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/botter_db

# Redis
REDIS_URL=redis://localhost:6379

# Payment Integration
TSPAY_SHOP_TOKEN=your_tspay_shop_token_here

# Application
NODE_ENV=development
PORT=3000
```

### Development Commands

```bash
# Development server with auto-reload
npm run dev

# Production build
npm run build

# Production start
npm start

# Run tests
npm test

# Database operations
npx prisma studio          # Database GUI
npx prisma migrate dev     # Run migrations
npx prisma generate        # Generate client
npx prisma migrate reset   # Reset database
```

## 🐳 Docker Deployment

### Single Container Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD npm run healthcheck

# Start application
CMD ["npm", "start"]
```

### Multi-Container Setup

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  app:
    build: .
    container_name: botter_app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/botter_db
      - REDIS_URL=redis://redis:6379
      - BOT_TOKEN=${BOT_TOKEN}
      - TSPAY_SHOP_TOKEN=${TSPAY_SHOP_TOKEN}
      - LOG_CHANNEL_ID=${LOG_CHANNEL_ID}
    depends_on:
      - db
      - redis
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - botter-network

  db:
    image: postgres:18.1-alpine
    container_name: botter_db
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=botter_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - botter-network

  redis:
    image: redis:7.2.8-alpine
    container_name: botter_redis
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - botter-network

  nginx:
    image: nginx:alpine
    container_name: botter_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - botter-network

networks:
  botter-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

### Deployment Commands

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Update deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🏢 Production Deployment

### Server Requirements

- **Minimum**: 2 vCPU, 4GB RAM, 20GB SSD
- **Recommended**: 4 vCPU, 8GB RAM, 50GB SSD
- **Operating System**: Ubuntu 20.04+ or CentOS 8+

### Production Environment Setup

1. **Server Preparation**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y docker.io docker-compose nginx certbot

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

2. **Application Deployment**

```bash
# Create deployment directory
sudo mkdir -p /opt/botter
sudo chown $USER:$USER /opt/botter
cd /opt/botter

# Clone repository
git clone https://github.com/yourusername/botter.git .
git checkout production

# Create environment file
cat > .env << EOF
NODE_ENV=production
BOT_TOKEN=your_production_token
DATABASE_URL=postgresql://postgres:secure_password@localhost:5432/botter_db
REDIS_URL=redis://localhost:6379
TSPAY_SHOP_TOKEN=your_production_tspay_token
LOG_CHANNEL_ID=your_log_channel_id
PORT=3000
EOF

# Set proper permissions
chmod 600 .env
```

3. **SSL Certificate Setup**

```bash
# Obtain SSL certificate
sudo certbot certonly --standalone -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

4. **Production Docker Setup**

```bash
# Create production docker-compose
cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  app:
    build: .
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - db
      - redis
    networks:
      - backend

  db:
    image: postgres:18.1-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=botter_db
      - POSTGRES_USER=botter_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backups
    networks:
      - backend

  redis:
    image: redis:7.2.8-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - backend
      - frontend

networks:
  frontend:
  backend:

volumes:
  postgres_data:
  redis_data:
EOF
```

## ☸️ Kubernetes Deployment

### Kubernetes Manifests

Create `k8s/` directory structure:

```
k8s/
├── configmaps/
│   └── app-config.yaml
├── secrets/
│   └── app-secrets.yaml
├── deployments/
│   ├── app-deployment.yaml
│   ├── db-deployment.yaml
│   └── redis-deployment.yaml
├── services/
│   ├── app-service.yaml
│   ├── db-service.yaml
│   └── redis-service.yaml
├── ingress/
│   └── app-ingress.yaml
└── cronjobs/
    └── backup-cronjob.yaml
```

### Main Application Deployment

```yaml
# k8s/deployments/app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: botter-app
  namespace: botter
spec:
  replicas: 3
  selector:
    matchLabels:
      app: botter-app
  template:
    metadata:
      labels:
        app: botter-app
    spec:
      containers:
        - name: app
          image: your-registry/botter:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

### Kubernetes Service

```yaml
# k8s/services/app-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: botter-app
  namespace: botter
spec:
  selector:
    app: botter-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

### Ingress Controller

```yaml
# k8s/ingress/app-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: botter-ingress
  namespace: botter
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - yourdomain.com
      secretName: botter-tls
  rules:
    - host: yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: botter-app
                port:
                  number: 80
```

### Deployment Commands

```bash
# Create namespace
kubectl create namespace botter

# Apply configurations
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress/

# Monitor deployment
kubectl get pods -n botter
kubectl logs -f deployment/botter-app -n botter
kubectl describe ingress botter-ingress -n botter
```

## ☁️ Cloud Provider Deployment

### AWS Deployment

```bash
# Using AWS ECS
# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service --service-name botter-service --task-definition botter-task

# Using AWS Elastic Beanstalk
eb init
eb create production
eb deploy
```

### Google Cloud Platform

```bash
# Using Cloud Run
gcloud run deploy botter \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Using GKE
gcloud container clusters create botter-cluster
kubectl apply -f k8s/
```

### Azure Deployment

```bash
# Using Azure Container Instances
az container create \
  --resource-group botter-rg \
  --name botter-app \
  --image your-registry/botter:latest \
  --dns-name-label botter-app \
  --ports 3000

# Using Azure Kubernetes Service
az aks create --resource-group botter-rg --name botter-aks
kubectl apply -f k8s/
```

## 🔄 Backup and Recovery

### Automated Backup Strategy

Create backup script `scripts/backup.sh`:

```bash
#!/bin/bash
# Database backup script

BACKUP_DIR="/opt/botter/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="botter_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DATABASE_URL > $BACKUP_DIR/$BACKUP_FILE

# Compress backup
gzip $BACKUP_DIR/$BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/$BACKUP_FILE.gz s3://your-backup-bucket/
```

### Recovery Process

```bash
# Restore database
gunzip backup_file.sql.gz
psql $DATABASE_URL < backup_file.sql

# Restore from cloud storage
# aws s3 cp s3://your-backup-bucket/backup_file.sql.gz ./
# gunzip backup_file.sql.gz
# psql $DATABASE_URL < backup_file.sql
```

### Cron Job Setup

```bash
# Add to crontab
0 2 * * * /opt/botter/scripts/backup.sh >> /var/log/botter-backup.log 2>&1
```

## 📊 Monitoring and Scaling

### Health Check Endpoint

Add to your application:

```typescript
// src/routes/health.ts
import { Router } from "express";

const router = Router();

router.get("/health", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.ping();

    // Check TsPay API
    // await tspay.checkHealth();

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "healthy",
        redis: "healthy",
        tspay: "healthy",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

export default router;
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

# Start services
sudo systemctl start prometheus node-exporter grafana-server
```

### Auto-scaling Configuration

For Kubernetes HPA:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: botter-hpa
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
```

## 🔧 Troubleshooting Deployment Issues

### Common Issues and Solutions

1. **Database Connection Failed**

```bash
# Check database service
docker-compose exec db pg_isready

# Check connection string
echo $DATABASE_URL
```

2. **Redis Connection Issues**

```bash
# Test Redis connection
docker-compose exec redis redis-cli ping
```

3. **Port Conflicts**

```bash
# Check used ports
sudo netstat -tlnp | grep :3000
```

4. **SSL Certificate Issues**

```bash
# Test certificate
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text
```

### Rollback Procedure

```bash
# Docker rollback
docker-compose down
git checkout previous-stable-commit
docker-compose up -d

# Kubernetes rollback
kubectl rollout undo deployment/botter-app
```

---

_For additional support, refer to the
[Troubleshooting Guide](TROUBLESHOOTING.md) or contact the development team._

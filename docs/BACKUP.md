# Backup and Recovery Strategy

## Overview

This document outlines the backup and recovery strategy for the Telegram Paywall Platform.

## Backup Components

### 1. Database Backup
- **Frequency**: Daily at 2:00 AM
- **Retention**: 30 days
- **Type**: Full database dump
- **Compression**: GZIP
- **Verification**: Integrity checks performed

### 2. Configuration Backup
- **Frequency**: Weekly
- **Retention**: 90 days
- **Contents**: 
  - Environment configuration templates
  - Package files
  - Prisma schema
  - Application configuration

### 3. Application Code Backup
- **Frequency**: With each deployment
- **Retention**: Indefinite (version control)
- **Contents**: Git repository with all source code

## Backup Storage Locations

### Primary Storage
- Local server storage: `/opt/botter/backups/`
- Automated cleanup of files older than retention period

### Secondary Storage (Optional)
- AWS S3 bucket for offsite backup
- Cloud storage provider of choice
- Encrypted backup archives

## Recovery Procedures

### Full System Recovery

1. **Prepare Environment**
   ```bash
   # Stop all services
   sudo systemctl stop botter
   docker-compose down
   
   # Ensure backup directory exists
   mkdir -p /opt/botter/backups
   ```

2. **Restore Database**
   ```bash
   # List available backups
   ls -la /opt/botter/backups/
   
   # Run restore script
   ./scripts/restore.sh botter_backup_20240101_120000
   ```

3. **Verify Recovery**
   ```bash
   # Check database connection
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
   
   # Check application health
   curl http://localhost:3000/health
   ```

### Partial Recovery

#### Database Only
```bash
# Extract specific backup
gunzip /opt/botter/backups/botter_backup_20240101_120000_database.sql.gz

# Restore to database
psql $DATABASE_URL < /opt/botter/backups/botter_backup_20240101_120000_database.sql
```

#### Configuration Only
```bash
# Extract config backup
tar -xzf /opt/botter/backups/botter_backup_20240101_120000_config.tar.gz -C /tmp/

# Review and manually restore needed files
cp /tmp/.env.example .env  # Review before copying
```

## Automation Setup

### Cron Job Configuration

Add to crontab:
```bash
# Daily database backup at 2:00 AM
0 2 * * * /opt/botter/scripts/backup.sh >> /var/log/botter/backup.log 2>&1

# Weekly configuration backup on Sundays at 3:00 AM
0 3 * * 0 /opt/botter/scripts/config-backup.sh >> /var/log/botter/config-backup.log 2>&1
```

### Systemd Timer (Alternative)

Create `/etc/systemd/system/botter-backup.service`:
```ini
[Unit]
Description=Botter Database Backup
Wants=botter-backup.timer

[Service]
Type=oneshot
ExecStart=/opt/botter/scripts/backup.sh
User=botter
Group=botter

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/botter-backup.timer`:
```ini
[Unit]
Description=Run botter backup daily
Requires=botter-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:
```bash
sudo systemctl enable botter-backup.timer
sudo systemctl start botter-backup.timer
```

## Monitoring and Alerts

### Backup Verification
```bash
# Check backup status
./scripts/check-backups.sh

# Monitor backup logs
tail -f /var/log/botter/backup.log
```

### Health Checks
- Database connectivity tests
- Backup file integrity verification
- Storage space monitoring
- Notification on backup failures

## Security Considerations

### Encryption
- Backup files should be encrypted at rest
- Use GPG for encryption:
  ```bash
  gpg --encrypt --recipient your-email@example.com backup-file.sql.gz
  ```

### Access Control
- Restrict backup directory permissions: `chmod 700 /opt/botter/backups`
- Use dedicated backup user with minimal privileges
- Rotate encryption keys regularly

### Sensitive Data Handling
- Exclude sensitive configuration from backups
- Use environment variables for secrets
- Never store passwords in backup files

## Testing Recovery

### Regular Testing Schedule
- Monthly recovery tests for database
- Quarterly full system recovery tests
- Document and update procedures based on test results

### Test Procedure
```bash
# 1. Set up test environment
docker-compose -f docker-compose.test.yml up -d

# 2. Perform restore to test environment
./scripts/restore.sh botter_backup_20240101_120000 test

# 3. Verify functionality
npm test
curl http://localhost:3001/health
```

## Disaster Recovery Plan

### Critical Failure Scenarios

1. **Database Server Failure**
   - Restore from latest backup
   - Reprovision database server
   - Update connection strings
   - Verify application connectivity

2. **Complete System Failure**
   - Provision new server
   - Restore application code from Git
   - Restore database from backup
   - Restore configuration files
   - Update DNS records
   - Test full functionality

3. **Data Corruption**
   - Identify corruption point
   - Restore from backup before corruption
   - Apply any subsequent legitimate changes
   - Verify data integrity

## Backup Verification Script

```bash
#!/bin/bash
# scripts/check-backups.sh

BACKUP_DIR="/opt/botter/backups"
LOG_FILE="/var/log/botter/backup-check.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    log "ERROR: Backup directory not found"
    exit 1
fi

# Check for recent backups
RECENT_BACKUPS=$(find "$BACKUP_DIR" -name "botter_backup_*" -type f -mtime -2 | wc -l)

if [ "$RECENT_BACKUPS" -eq 0 ]; then
    log "WARNING: No recent backups found"
    exit 1
fi

log "Found $RECENT_BACKUPS recent backups"

# Check backup file integrity
for backup in "$BACKUP_DIR"/botter_backup_*_database.sql.gz; do
    if [ -f "$backup" ]; then
        if gzip -t "$backup" 2>/dev/null; then
            log "✓ Database backup integrity verified: $(basename "$backup")"
        else
            log "✗ Database backup corrupted: $(basename "$backup")"
        fi
    fi
done

log "Backup verification completed"
```

## Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

### RTO Targets
- **Database Recovery**: < 2 hours
- **Full System Recovery**: < 4 hours
- **Configuration Recovery**: < 30 minutes

### RPO Targets
- **Database**: < 24 hours (daily backups)
- **Configuration**: < 7 days (weekly backups)
- **Code**: < 1 hour (continuous integration)

---

*Last updated: January 2026*
*Review frequency: Quarterly*
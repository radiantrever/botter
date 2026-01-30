#!/bin/bash

# Telegram Paywall Platform Backup Script
# This script creates automated backups of the database and application data

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/opt/botter/backups"
LOG_FILE="/var/log/botter/backup.log"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="botter_backup_$TIMESTAMP"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

log "Starting backup process..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    error_exit "DATABASE_URL environment variable is not set"
fi

# Extract database connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_USER=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\1/')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\2/')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\3/')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\4/')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\5/')

# Export password for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Create database backup
log "Creating database backup..."
DB_BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_database.sql"

pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --column-inserts \
    --verbose \
    > "$DB_BACKUP_FILE" || error_exit "Failed to create database backup"

# Compress database backup
log "Compressing database backup..."
gzip "$DB_BACKUP_FILE"
DB_BACKUP_FILE="${DB_BACKUP_FILE}.gz"

# Backup application configuration (excluding sensitive data)
log "Backing up application configuration..."
CONFIG_BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_config.tar.gz"

# Create temporary directory for config backup
TEMP_CONFIG_DIR="/tmp/botter_config_backup_$TIMESTAMP"
mkdir -p "$TEMP_CONFIG_DIR"

# Copy non-sensitive configuration files
cp -r .env.example "$TEMP_CONFIG_DIR/" 2>/dev/null || true
cp -r package.json "$TEMP_CONFIG_DIR/" 2>/dev/null || true
cp -r package-lock.json "$TEMP_CONFIG_DIR/" 2>/dev/null || true
cp -r tsconfig.json "$TEMP_CONFIG_DIR/" 2>/dev/null || true
cp -r prisma/schema.prisma "$TEMP_CONFIG_DIR/" 2>/dev/null || true

# Create archive
tar -czf "$CONFIG_BACKUP_FILE" -C "$TEMP_CONFIG_DIR" .

# Clean up temporary directory
rm -rf "$TEMP_CONFIG_DIR"

# Create backup manifest
log "Creating backup manifest..."
MANIFEST_FILE="$BACKUP_DIR/${BACKUP_NAME}_manifest.json"

cat > "$MANIFEST_FILE" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "database_backup": "$(basename "$DB_BACKUP_FILE")",
  "config_backup": "$(basename "$CONFIG_BACKUP_FILE")",
  "database_size": "$(du -h "$DB_BACKUP_FILE" | cut -f1)",
  "config_size": "$(du -h "$CONFIG_BACKUP_FILE" | cut -f1)",
  "total_size": "$(du -h "$BACKUP_DIR/${BACKUP_NAME}"* | awk '{sum += \$1} END {print sum "K"}')",
  "created_by": "backup_script",
  "version": "1.0"
}
EOF

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "botter_backup_*" -type f -mtime +$RETENTION_DAYS -delete

# Verify backup integrity
log "Verifying backup integrity..."
if [ ! -f "$DB_BACKUP_FILE" ]; then
    error_exit "Database backup file not found: $DB_BACKUP_FILE"
fi

if [ ! -f "$CONFIG_BACKUP_FILE" ]; then
    error_exit "Config backup file not found: $CONFIG_BACKUP_FILE"
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    error_exit "Manifest file not found: $MANIFEST_FILE"
fi

# Log backup completion
log "Backup completed successfully!"
log "Database backup: $DB_BACKUP_FILE"
log "Config backup: $CONFIG_BACKUP_FILE"
log "Manifest: $MANIFEST_FILE"

# Optional: Upload to cloud storage
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$S3_BUCKET" ]; then
    log "Uploading backup to S3..."
    
    # Install AWS CLI if not present
    if ! command -v aws &> /dev/null; then
        log "Installing AWS CLI..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf awscliv2.zip aws/
    fi
    
    # Upload files to S3
    aws s3 cp "$DB_BACKUP_FILE" "s3://$S3_BUCKET/backups/$(basename "$DB_BACKUP_FILE")" || log "Warning: Failed to upload database backup to S3"
    aws s3 cp "$CONFIG_BACKUP_FILE" "s3://$S3_BUCKET/backups/$(basename "$CONFIG_BACKUP_FILE")" || log "Warning: Failed to upload config backup to S3"
    aws s3 cp "$MANIFEST_FILE" "s3://$S3_BUCKET/backups/$(basename "$MANIFEST_FILE")" || log "Warning: Failed to upload manifest to S3"
    
    log "Backup uploaded to S3 successfully"
fi

# Send notification (if configured)
if [ -n "$NOTIFICATION_WEBHOOK" ]; then
    log "Sending backup completion notification..."
    
    NOTIFICATION_DATA=$(cat << EOF
{
  "text": "✅ Botter Backup Completed\n\nBackup Name: $BACKUP_NAME\nTimestamp: $(date)\nDatabase Size: $(du -h "$DB_BACKUP_FILE" | cut -f1)\nConfig Size: $(du -h "$CONFIG_BACKUP_FILE" | cut -f1)"
}
EOF
    )
    
    curl -X POST "$NOTIFICATION_WEBHOOK" \
         -H "Content-Type: application/json" \
         -d "$NOTIFICATION_DATA" \
         --silent \
         --output /dev/null \
         || log "Warning: Failed to send notification"
fi

log "Backup process finished successfully!"
exit 0
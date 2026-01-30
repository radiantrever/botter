#!/bin/bash

# Telegram Paywall Platform Restore Script
# This script restores the application from backup files

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/opt/botter/backups"
LOG_FILE="/var/log/botter/restore.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Usage function
usage() {
    echo "Usage: $0 <backup_name>"
    echo "Example: $0 botter_backup_20240101_120000"
    exit 1
}

# Check arguments
if [ $# -ne 1 ]; then
    usage
fi

BACKUP_NAME="$1"
log "Starting restore process for backup: $BACKUP_NAME"

# Check if backup exists
if [ ! -d "$BACKUP_DIR" ]; then
    error_exit "Backup directory not found: $BACKUP_DIR"
fi

# Find backup files
DB_BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_database.sql.gz"
CONFIG_BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}_config.tar.gz"
MANIFEST_FILE="$BACKUP_DIR/${BACKUP_NAME}_manifest.json"

if [ ! -f "$DB_BACKUP_FILE" ]; then
    error_exit "Database backup not found: $DB_BACKUP_FILE"
fi

if [ ! -f "$CONFIG_BACKUP_FILE" ]; then
    error_exit "Config backup not found: $CONFIG_BACKUP_FILE"
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    error_exit "Manifest file not found: $MANIFEST_FILE"
fi

log "Found backup files:"
log "  Database: $DB_BACKUP_FILE"
log "  Config: $CONFIG_BACKUP_FILE"
log "  Manifest: $MANIFEST_FILE"

# Confirm restore operation
echo "⚠️  WARNING: This will restore the database and may overwrite existing data!"
echo "Backup name: $BACKUP_NAME"
echo "Timestamp: $(jq -r '.timestamp' "$MANIFEST_FILE")"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

# Stop application services
log "Stopping application services..."
sudo systemctl stop botter 2>/dev/null || true
docker-compose down 2>/dev/null || true

# Restore database
log "Restoring database..."
# Extract database connection details from DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\1/')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\2/')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\3/')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\4/')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's/postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/(.+)/\5/')

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

# Drop and recreate database
log "Dropping existing database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || log "Warning: Failed to drop database"

log "Creating new database..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || error_exit "Failed to create database"

# Restore database from backup
log "Restoring database from backup..."
gunzip -c "$DB_BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" || error_exit "Failed to restore database"

# Restore configuration files (optional)
log "Restoring configuration files..."
TEMP_RESTORE_DIR="/tmp/botter_restore_$TIMESTAMP"
mkdir -p "$TEMP_RESTORE_DIR"

# Extract config backup
tar -xzf "$CONFIG_BACKUP_FILE" -C "$TEMP_RESTORE_DIR"

# Copy configuration files (be careful not to overwrite sensitive data)
if [ -f "$TEMP_RESTORE_DIR/.env.example" ]; then
    log "Found .env.example in backup - review and update your current .env file manually"
fi

if [ -f "$TEMP_RESTORE_DIR/package.json" ]; then
    cp "$TEMP_RESTORE_DIR/package.json" ./ || log "Warning: Could not restore package.json"
fi

if [ -f "$TEMP_RESTORE_DIR/tsconfig.json" ]; then
    cp "$TEMP_RESTORE_DIR/tsconfig.json" ./ || log "Warning: Could not restore tsconfig.json"
fi

if [ -f "$TEMP_RESTORE_DIR/prisma/schema.prisma" ]; then
    cp "$TEMP_RESTORE_DIR/prisma/schema.prisma" ./prisma/ || log "Warning: Could not restore schema.prisma"
fi

# Clean up temporary directory
rm -rf "$TEMP_RESTORE_DIR"

# Run database migrations (if needed)
log "Running database migrations..."
npx prisma generate || log "Warning: Failed to generate Prisma client"
npx prisma migrate deploy || log "Warning: Failed to run migrations"

# Start application services
log "Starting application services..."
docker-compose up -d 2>/dev/null || sudo systemctl start botter 2>/dev/null || log "Warning: Could not start services automatically"

# Verify restore
log "Verifying restore..."
sleep 10  # Wait for services to start

# Check database connection
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    log "Database connection verified successfully"
else
    error_exit "Database connection failed after restore"
fi

# Check application health (if health endpoint exists)
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    log "Application health check passed"
else
    log "Warning: Application health check failed - please verify manually"
fi

log "Restore completed successfully!"
log "Backup restored: $BACKUP_NAME"
log "Restore timestamp: $TIMESTAMP"
log "Please verify that the application is working correctly"

exit 0
#!/bin/bash

# Exit on any error
set -e

# Remove previous build
rm -rf mediasoup-nodejs

# Clone the repository
git clone --depth 1 https://github.com/manit77/mediasoup-nodejs.git
cd mediasoup-nodejs

# Check if package-lock.json exists
PACKAGE_LOCK="package-lock.json"
PACKAGE_LOCK_HASH_FILE="../package-lock-hash.txt"
ARCHIVE_FILE="../node_modules.tar.gz"

if [ ! -f "$PACKAGE_LOCK" ]; then
    echo "Error: $PACKAGE_LOCK not found in $(pwd)"
    exit 1
fi

# Generate hash of package-lock.json
CURRENT_HASH=$(sha256sum "$PACKAGE_LOCK" | awk '{print $1}')
if [ -z "$CURRENT_HASH" ]; then
    echo "Error: Failed to generate hash for $PACKAGE_LOCK"
    exit 1
fi

# Check if hash file exists and compare
if [ -f "$PACKAGE_LOCK_HASH_FILE" ]; then
    PREVIOUS_HASH=$(cat "$PACKAGE_LOCK_HASH_FILE")
    if [ "$CURRENT_HASH" = "$PREVIOUS_HASH" ] && [ -f "$ARCHIVE_FILE" ]; then
        echo "package-lock.json unchanged, restoring node_modules from archive"
        tar -xzf "$ARCHIVE_FILE" -C .
    else
        echo "package-lock.json changed or archive missing, installing dependencies"
        npm ci
        # Archive node_modules
        tar -czf "$ARCHIVE_FILE" node_modules
        # Update hash file
        echo "$CURRENT_HASH" > "$PACKAGE_LOCK_HASH_FILE"
    fi
else
    echo "No previous hash found, installing dependencies"
    npm ci
    # Archive node_modules
    tar -czf "$ARCHIVE_FILE" node_modules
    # Store hash
    echo "$CURRENT_HASH" > "$PACKAGE_LOCK_HASH_FILE"
fi

# Verify hash file is not empty
if [ ! -s "$PACKAGE_LOCK_HASH_FILE" ]; then
    echo "Error: $PACKAGE_LOCK_HASH_FILE is empty"
    exit 1
fi

# Run deploy
npm run deploy

# Move back to parent directory
cd ..

# Copy configuration files
cp conf-client-app.config.json mediasoup-nodejs/deploy/conf-client-app/config.json 
cp conf-server.env.json mediasoup-nodejs/deploy/conf-server/.env.json
cp conf-server.env.json mediasoup-nodejs/deploy/rooms-server/.env.json

# Remove old deployments
rm -rf /var/www/conf-client-app
rm -rf /var/www/conf-server
rm -rf /var/www/rooms-server

# Copy new deployment
cp -rf mediasoup-nodejs/deploy/. /var/www

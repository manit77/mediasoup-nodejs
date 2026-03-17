#!/bin/bash

# 1. Clear previous build artifacts
rm -rf dist release

security find-identity -v -p codesigning
export CSC_NAME="NEED_TO_SET_CERTIFICATE_NAME"
export APPLE_TEAM_ID="NEED_TO_SET_TEAM_ID"
export CSC_IDENTITY_AUTO_DISCOVERY=false

echo "🚀 Building for Team: $APPLE_TEAM_ID using Certificate Fingerprint: $CSC_NAME"

npm run build
npx electron-builder --mac --arm64 -c electron-builder.config.js
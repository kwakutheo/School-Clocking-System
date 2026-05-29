#!/bin/sh
set -e

# Write Firebase service account to disk if provided via env vars.
# Support either a base64-encoded value (FIREBASE_SERVICE_ACCOUNT_BASE64)
# or a JSON string (FIREBASE_SERVICE_ACCOUNT_JSON).
if [ -n "$FIREBASE_SERVICE_ACCOUNT_BASE64" ]; then
  echo "Writing firebase service account from FIREBASE_SERVICE_ACCOUNT_BASE64..."
  echo "$FIREBASE_SERVICE_ACCOUNT_BASE64" | base64 -d > /app/firebase-service-account.json
  export GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
elif [ -n "$FIREBASE_SERVICE_ACCOUNT_JSON" ]; then
  echo "Writing firebase service account from FIREBASE_SERVICE_ACCOUNT_JSON..."
  echo "$FIREBASE_SERVICE_ACCOUNT_JSON" > /app/firebase-service-account.json
  export GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
fi

echo "Starting TK Clocking backend..."
exec node dist/src/main

#!/bin/sh
# Entrypoint for backend container - runs migrations then starts server.
# Used for Azure App Service and other standalone deployments.
# DB connection: postgres://USER:PASS@HOST:PORT/DB?sslmode=...

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-timebook}"
DB_PASSWORD="${DB_PASSWORD:-timebook}"
DB_NAME="${DB_NAME:-timebook}"
DB_SSLMODE="${DB_SSLMODE:-disable}"

DB_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=${DB_SSLMODE}"

echo "Waiting for database..."
sleep 3

echo "Running migrations..."
if migrate -path /root/migrations -database "$DB_URL" up 2>/dev/null; then
  echo "Migrations completed."
else
  echo "Migrations failed or already up - continuing..."
fi

echo "Starting server..."
exec ./server

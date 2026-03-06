#!/bin/bash
# Deploy Timebook backend to Azure App Service
# Prerequisites: az login, Docker running
# Usage: ./scripts/deploy-backend-azure.sh [resource-group] [postgres-server-name]

set -e

# Configuration - EDIT THESE or pass as args
RESOURCE_GROUP="${1:-timebook-rg}"
POSTGRES_SERVER="${2:-}"  # e.g. my-postgres-server or my-server.postgres.database.azure.com
PG_RESOURCE_GROUP="${PG_RESOURCE_GROUP:-$RESOURCE_GROUP}"  # Use if PostgreSQL is in different RG
LOCATION="${LOCATION:-eastus}"
ACR_NAME="${ACR_NAME:-timebookacr$(openssl rand -hex 3)}"  # Must be globally unique
APP_NAME="${APP_NAME:-timebook-api}"

echo "=== Timebook Backend Azure Deployment ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "ACR Name: $ACR_NAME"
echo "App Name: $APP_NAME"
echo ""

# Check login
if ! az account show &>/dev/null; then
  echo "Error: Not logged in to Azure. Run: az login"
  exit 1
fi

# Create resource group if it doesn't exist
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# Find PostgreSQL server if not provided
if [ -z "$POSTGRES_SERVER" ]; then
  echo "Listing PostgreSQL Flexible Servers in subscription..."
  az postgres flexible-server list --query "[].{name:name, fqdn:fullyQualifiedDomainName, rg:resourceGroup}" -o table 2>/dev/null || true
  echo ""
  read -p "Enter your PostgreSQL server name (short name or full FQDN): " POSTGRES_SERVER
  if [ -z "$POSTGRES_SERVER" ]; then
    echo "Error: PostgreSQL server name required"
    exit 1
  fi
  read -p "Resource group where PostgreSQL lives [$RESOURCE_GROUP]: " PG_RESOURCE_GROUP
  PG_RESOURCE_GROUP="${PG_RESOURCE_GROUP:-$RESOURCE_GROUP}"
fi

# Get PostgreSQL FQDN and short name
if [[ "$POSTGRES_SERVER" != *".postgres.database.azure.com" ]]; then
  DB_HOST="${POSTGRES_SERVER}.postgres.database.azure.com"
  PG_SHORT_NAME="$POSTGRES_SERVER"
else
  DB_HOST="$POSTGRES_SERVER"
  PG_SHORT_NAME="${POSTGRES_SERVER%%.*}"  # e.g. my-server from my-server.postgres...
fi

echo "Database host: $DB_HOST"
read -p "PostgreSQL admin username: " DB_USER
read -sp "PostgreSQL admin password: " DB_PASS
echo ""
read -p "Database name [timebook]: " DB_NAME
DB_NAME="${DB_NAME:-timebook}"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JWT_SECRET"

# Create ACR (admin disabled - we use managed identity for pulls)
echo ""
echo "Creating Container Registry..."
az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" --sku Basic --admin-enabled false --output none

# Build and push
echo ""
echo "Building Docker image..."
cd "$(dirname "$0")/.."
docker build -f Dockerfile.backend -t "${ACR_NAME}.azurecr.io/timebook-backend:latest" .

echo "Logging into ACR..."
az acr login --name "$ACR_NAME"

echo "Pushing image..."
docker push "${ACR_NAME}.azurecr.io/timebook-backend:latest"

# Create App Service Plan and Web App
echo ""
echo "Creating App Service..."
az appservice plan create \
  --resource-group "$RESOURCE_GROUP" \
  --name "${APP_NAME}-plan" \
  --is-linux \
  --sku B1 \
  --output none 2>/dev/null || true

az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "${APP_NAME}-plan" \
  --name "$APP_NAME" \
  --deployment-container-image-name "${ACR_NAME}.azurecr.io/timebook-backend:latest" \
  --output none

# Enable managed identity and grant AcrPull (no admin credentials needed)
echo ""
echo "Configuring managed identity for ACR image pull..."
az webapp identity assign --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --output none 2>/dev/null || true
PRINCIPAL_ID=$(az webapp identity show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query principalId -o tsv)
ACR_ID=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --scope "$ACR_ID" \
  --role AcrPull \
  --output none 2>/dev/null || echo "  -> Role may already exist"

# Wait for RBAC propagation (managed identity can take 1-2 min to propagate)
echo "  -> Waiting 45s for RBAC propagation..."
sleep 45

# Configure container (managed identity used for pull - no credentials)
az webapp config container set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --docker-custom-image-name "${ACR_NAME}.azurecr.io/timebook-backend:latest" \
  --docker-registry-server-url "https://${ACR_NAME}.azurecr.io" \
  --output none

echo "  -> Managed identity configured; AcrPull role assigned"

# Configure app settings (before restart so app has DB/JWT when it starts)
echo ""
echo "Configuring environment variables..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --settings \
    DB_HOST="$DB_HOST" \
    DB_PORT="5432" \
    DB_USER="$DB_USER" \
    DB_PASSWORD="$DB_PASS" \
    DB_NAME="$DB_NAME" \
    DB_SSLMODE="require" \
    SERVER_PORT="8080" \
    SERVER_HOST="0.0.0.0" \
    JWT_SECRET="$JWT_SECRET" \
    ENVIRONMENT="production" \
    CORS_ALLOWED_ORIGINS="https://${APP_NAME}.azurewebsites.net,http://localhost:5173" \
    WEBSITES_PORT="8080" \
  --output none

# Ensure PostgreSQL firewall allows Azure services (Flexible Server)
echo ""
echo "Adding firewall rule (run manually if your PostgreSQL is in a different resource group)..."
az postgres flexible-server firewall-rule create \
  --resource-group "$PG_RESOURCE_GROUP" \
  --name "$PG_SHORT_NAME" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none 2>/dev/null || echo "  -> Add firewall rule in Azure Portal: PostgreSQL > Networking > Allow Azure services"

# Create database if it doesn't exist (Flexible Server)
echo ""
echo "Creating database '$DB_NAME' if not exists..."
az postgres flexible-server db create \
  --resource-group "$PG_RESOURCE_GROUP" \
  --server-name "$PG_SHORT_NAME" \
  --database-name "$DB_NAME" \
  --output none 2>/dev/null || echo "  -> Create database manually in Azure Portal if needed"

# Restart to pull image with managed identity (initial create may have failed)
echo ""
echo "Restarting app to pull image with managed identity..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --output none

echo ""
echo "=== Deployment Complete ==="
echo "Backend URL: https://${APP_NAME}.azurewebsites.net"
echo "Health check: https://${APP_NAME}.azurewebsites.net/health"
echo ""
echo "Update CORS_ALLOWED_ORIGINS when you deploy the frontend:"
echo "  az webapp config appsettings set -g $RESOURCE_GROUP -n $APP_NAME --settings CORS_ALLOWED_ORIGINS=\"https://your-frontend-url.azurestaticapps.net\""

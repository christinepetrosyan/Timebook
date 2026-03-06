#!/bin/bash
# Deploy Timebook frontend to Azure Static Web Apps and bind with backend
# Prerequisites: az login, backend already deployed
# Usage: ./scripts/deploy-frontend-azure.sh [resource-group] [backend-app-name]

set -e

# Configuration
RESOURCE_GROUP="${1:-timebook-rg}"
BACKEND_APP_NAME="${2:-timebook-api}"
FRONTEND_APP_NAME="${FRONTEND_APP_NAME:-timebook-app}"
LOCATION="${LOCATION:-westeurope}"

echo "=== Timebook Frontend Azure Deployment ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Backend API: $BACKEND_APP_NAME"
echo "Frontend App: $FRONTEND_APP_NAME"
echo ""

# Check login
if ! az account show &>/dev/null; then
  echo "Error: Not logged in to Azure. Run: az login"
  exit 1
fi

# Backend URL (Azure App Service)
BACKEND_URL="https://${BACKEND_APP_NAME}.azurewebsites.net"
API_URL="${BACKEND_URL}/api"

# Verify backend exists
BACKEND_FOUND=true
if ! az webapp show --name "$BACKEND_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  echo "Warning: Backend app '$BACKEND_APP_NAME' not found in resource group '$RESOURCE_GROUP'"
  read -p "Enter backend URL (e.g. https://timebook-api.azurewebsites.net): " BACKEND_URL
  API_URL="${BACKEND_URL%/}/api"
  BACKEND_FOUND=false
fi

echo "API URL for frontend: $API_URL"
echo ""

# Create Static Web App if it doesn't exist
if ! az staticwebapp show --name "$FRONTEND_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  echo "Creating Static Web App..."
  az staticwebapp create \
    --name "$FRONTEND_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none
  echo "Static Web App created."
else
  echo "Static Web App '$FRONTEND_APP_NAME' already exists."
fi

# Get deployment token
echo ""
echo "Getting deployment token..."
DEPLOY_TOKEN=$(az staticwebapp secrets list \
  --name "$FRONTEND_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" -o tsv)

if [ -z "$DEPLOY_TOKEN" ] || [ "$DEPLOY_TOKEN" == "null" ]; then
  echo "Error: Could not get deployment token. Check Static Web App exists."
  exit 1
fi

# Get frontend URL for CORS update
FRONTEND_URL=$(az staticwebapp show \
  --name "$FRONTEND_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "defaultHostname" -o tsv)
FRONTEND_URL="https://${FRONTEND_URL}"

echo "Frontend will be at: $FRONTEND_URL"
echo ""

# Build frontend with API URL
echo "Building frontend..."
cd "$(dirname "$0")/../frontend"
export VITE_API_URL="$API_URL"
npm ci
npm run build

if [ ! -d "dist" ]; then
  echo "Error: Build failed - dist folder not found"
  exit 1
fi

# Deploy using SWA CLI
echo ""
echo "Deploying to Azure Static Web Apps..."
npx --yes @azure/static-web-apps-cli deploy ./dist \
  --deployment-token "$DEPLOY_TOKEN" \
  --env production

# Update backend CORS to allow frontend origin (only if backend was found)
if [ "$BACKEND_FOUND" = true ]; then
  echo ""
  echo "Updating backend CORS to allow frontend..."
  CURRENT_CORS=$(az webapp config appsettings list \
    --name "$BACKEND_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='CORS_ALLOWED_ORIGINS'].value" -o tsv 2>/dev/null || echo "")

  # Append frontend URL if not already present
  if [[ "$CURRENT_CORS" != *"$FRONTEND_URL"* ]]; then
    NEW_CORS="$FRONTEND_URL"
    if [ -n "$CURRENT_CORS" ]; then
      NEW_CORS="${CURRENT_CORS},${FRONTEND_URL}"
    fi
    az webapp config appsettings set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$BACKEND_APP_NAME" \
      --settings CORS_ALLOWED_ORIGINS="$NEW_CORS" \
      --output none
    echo "Backend CORS updated."
  else
    echo "Backend CORS already includes frontend URL."
  fi
else
  echo ""
  echo "IMPORTANT: Manually add frontend URL to backend CORS:"
  echo "  az webapp config appsettings set -g <backend-rg> -n <backend-app> --settings CORS_ALLOWED_ORIGINS=\"...,$FRONTEND_URL\""
fi

echo ""
echo "=== Deployment Complete ==="
echo "Frontend URL: $FRONTEND_URL"
echo "Backend API:  $API_URL"
echo ""
echo "The frontend is now bound to your backend. Test the app at: $FRONTEND_URL"

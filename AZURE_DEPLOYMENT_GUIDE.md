# Timebook Azure Deployment Guide

Step-by-step instructions for deploying the Timebook frontend and backend to Microsoft Azure Portal.

---

## Architecture Overview

| Component | Azure Service | Purpose |
|-----------|---------------|---------|
| **Database** | Azure Database for PostgreSQL Flexible Server | Persistent data storage |
| **Backend** | Azure App Service (Linux, Docker) | Go API server |
| **Frontend** | Azure Static Web Apps | React SPA (Vite) |

---

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- [Docker](https://docs.docker.com/get-docker/) installed (for local build verification)
- Azure subscription ([free tier](https://azure.microsoft.com/free/) available)
- Git repository (GitHub recommended for Static Web Apps)

---

## Part 1: Azure Setup

### Step 1.1: Login and Create Resource Group

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "Your Subscription Name"

# Create resource group (choose a region near your users)
az group create --name timebook-rg --location eastus
```

### Step 2: Create PostgreSQL Database

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group timebook-rg \
  --name timebook-db \
  --location eastus \
  --admin-user timebookadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 14

# Create database
az postgres flexible-server db create \
  --resource-group timebook-rg \
  --server-name timebook-db \
  --database-name timebook

# Allow Azure services to access (required for App Service)
az postgres flexible-server firewall-rule create \
  --resource-group timebook-rg \
  --name timebook-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**Note:** For production, restrict the firewall to your App Service outbound IPs. Get them with:
```bash
az webapp show --name timebook-api --resource-group timebook-rg --query outboundIpAddresses
```

---

## Part 2: Backend Deployment (Azure App Service)

### Step 2.1: Create Container Registry (ACR)

```bash
# Create Azure Container Registry
az acr create \
  --resource-group timebook-rg \
  --name timebookacr \
  --sku Basic \
  --admin-enabled true

# Get ACR credentials
az acr credential show --name timebookacr
```

### Step 2.2: Build and Push Backend Image

```bash
# Login to ACR
az acr login --name timebookacr

# Build and push (from project root)
docker build -f Dockerfile.backend -t timebookacr.azurecr.io/timebook-backend:latest .
docker push timebookacr.azurecr.io/timebook-backend:latest
```

### Step 2.3: Create App Service Plan and Web App

```bash
# Create App Service plan (Linux)
az appservice plan create \
  --resource-group timebook-rg \
  --name timebook-plan \
  --is-linux \
  --sku B1

# Create Web App for backend
az webapp create \
  --resource-group timebook-rg \
  --plan timebook-plan \
  --name timebook-api \
  --deployment-container-image-name timebookacr.azurecr.io/timebook-backend:latest
```

### Step 2.4: Configure Backend Environment Variables

```bash
# Get database connection info
DB_HOST=$(az postgres flexible-server show --resource-group timebook-rg --name timebook-db --query fullyQualifiedDomainName -o tsv)

# Generate a secure JWT secret (run locally)
# openssl rand -base64 32

az webapp config appsettings set \
  --resource-group timebook-rg \
  --name timebook-api \
  --settings \
    DB_HOST="$DB_HOST" \
    DB_PORT="5432" \
    DB_USER="timebookadmin" \
    DB_PASSWORD="YourSecurePassword123!" \
    DB_NAME="timebook" \
    DB_SSLMODE="require" \
    SERVER_PORT="8080" \
    SERVER_HOST="0.0.0.0" \
    JWT_SECRET="YOUR_GENERATED_JWT_SECRET_HERE" \
    ENVIRONMENT="production" \
    CORS_ALLOWED_ORIGINS="https://your-frontend-url.azurestaticapps.net,https://your-custom-domain.com" \
    APP_BASE_URL="https://your-frontend-url.azurestaticapps.net" \
    WEBSITES_PORT="8080"
```

### Step 2.5: Configure ACR for App Service

```bash
# Get ACR credentials
ACR_USER=$(az acr credential show --name timebookacr --query username -o tsv)
ACR_PASS=$(az acr credential show --name timebookacr --query "passwords[0].value" -o tsv)

az webapp config container set \
  --resource-group timebook-rg \
  --name timebook-api \
  --docker-custom-image-name timebookacr.azurecr.io/timebook-backend:latest \
  --docker-registry-server-url https://timebookacr.azurecr.io \
  --docker-registry-server-user $ACR_USER \
  --docker-registry-server-password $ACR_PASS
```

### Step 2.6: Run Database Migrations

**Automatic on startup (recommended):** The backend Docker image includes an entrypoint script that runs migrations automatically when the container starts. No manual step needed—migrations run before the server starts.

**Manual option (if needed):** Run from your local machine with network access to Azure:

```bash
# Get connection string (use SSL)
DB_HOST=$(az postgres flexible-server show --resource-group timebook-rg --name timebook-db --query fullyQualifiedDomainName -o tsv)

# Install migrate: https://github.com/golang-migrate/migrate
migrate -path backend/migrations -database "postgres://timebookadmin:YourSecurePassword123!@$DB_HOST:5432/timebook?sslmode=require" up
```

### Step 2.7: Enable HTTPS and Custom Domain (Optional)

```bash
# App Service uses HTTPS by default: https://timebook-api.azurewebsites.net
# For custom domain:
az webapp config hostname add --webapp-name timebook-api --resource-group timebook-rg --hostname api.yourdomain.com
```

---

## Part 3: Frontend Deployment (Azure Static Web Apps)

### Step 3.1: Prepare Frontend for Production

Ensure your frontend uses the backend URL. Create a `.env.production` file (or set in build):

```env
VITE_API_URL=https://timebook-api.azurewebsites.net/api
VITE_BASE_URL=/
```

### Step 3.2: Deploy via Azure Portal (GitHub Integration)

1. Go to [Azure Portal](https://portal.azure.com) → **Create a resource** → **Static Web App**
2. Fill in:
   - **Subscription**: Your subscription
   - **Resource group**: `timebook-rg`
   - **Name**: `timebook-app`
   - **Plan type**: Free
   - **Source**: GitHub (connect your repo)
   - **Organization/Repository**: Select your Timebook repo
   - **Branch**: `main` (or your deployment branch)
   - **Build Presets**: Custom
   - **App location**: `/frontend`
   - **Output location**: `dist`
   - **Build command**: `npm run build`

3. **Add build environment variables** (in Configuration after creation):
   - `VITE_API_URL` = `https://timebook-api.azurewebsites.net/api`

4. Click **Review + create** → **Create**

### Step 3.3: Deploy via Script (Recommended - no GitHub required)

```bash
# From project root - deploys frontend and binds to backend
./scripts/deploy-frontend-azure.sh timebook-rg timebook-api
```

The script will:
- Create Static Web App
- Build frontend with `VITE_API_URL` pointing to your backend
- Deploy to Azure
- Update backend CORS automatically

### Step 3.4: Deploy via Azure CLI (Alternative - GitHub)

```bash
# Create Static Web App with GitHub
az staticwebapp create \
  --name timebook-app \
  --resource-group timebook-rg \
  --source https://github.com/YOUR_USERNAME/Timebook \
  --branch main \
  --app-location "/frontend" \
  --output-location "dist" \
  --login-with-github

# Add environment variable for API URL
az staticwebapp appsettings set \
  --name timebook-app \
  --resource-group timebook-rg \
  --setting-names "VITE_API_URL=https://timebook-api.azurewebsites.net/api"
```

### Step 3.5: Update CORS on Backend

After frontend is deployed, get its URL and update backend CORS:

```bash
# Get Static Web App URL (usually: https://timebook-app.azurestaticapps.net)
az staticwebapp show --name timebook-app --resource-group timebook-rg --query defaultHostname -o tsv

# Update backend CORS
az webapp config appsettings set \
  --resource-group timebook-rg \
  --name timebook-api \
  --settings CORS_ALLOWED_ORIGINS="https://timebook-app.azurestaticapps.net"
```

---

## Part 4: Alternative – Deploy Both with Docker (App Service)

If you prefer to keep the nginx proxy setup (frontend + backend behind one domain):

### Step 4.1: Create Combined Docker Compose for Azure

Create `docker-compose.azure.yml` that uses Azure PostgreSQL connection string and builds both services. Then deploy the **frontend** container to a separate App Service that proxies to backend.

Or use **Azure Container Apps** for a more container-native approach:

```bash
# Create Container Apps environment
az containerapp env create \
  --name timebook-env \
  --resource-group timebook-rg \
  --location eastus

# Create backend container app
az containerapp create \
  --name timebook-api \
  --resource-group timebook-rg \
  --environment timebook-env \
  --image timebookacr.azurecr.io/timebook-backend:latest \
  --target-port 8080 \
  --ingress external \
  --registry-server timebookacr.azurecr.io \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --env-vars "DB_HOST=..." "JWT_SECRET=..." # etc.
```

---

## Part 5: Post-Deployment Checklist

- [ ] **Database migrations** ran successfully
- [ ] **Backend health check**: `curl https://timebook-api.azurewebsites.net/health`
- [ ] **Frontend** loads and can login/register
- [ ] **CORS** allows frontend origin (check browser console for errors)
- [ ] **JWT_SECRET** is unique and secure (not default)
- [ ] **PostgreSQL SSL**: Use `sslmode=require` for Azure DB
- [ ] **Telegram webhook** (if used): Update to `https://timebook-api.azurewebsites.net/api/telegram/webhook`

---

## Environment Variables Reference

### Backend (App Service)

| Variable | Required | Example |
|----------|----------|---------|
| DB_HOST | Yes | timebook-db.postgres.database.azure.com |
| DB_PORT | Yes | 5432 |
| DB_USER | Yes | timebookadmin |
| DB_PASSWORD | Yes | (your password) |
| DB_NAME | Yes | timebook |
| DB_SSLMODE | Yes | require |
| JWT_SECRET | Yes | (generate with `openssl rand -base64 32`) |
| CORS_ALLOWED_ORIGINS | Yes | https://timebook-app.azurestaticapps.net |
| ENVIRONMENT | Yes | production |
| APP_BASE_URL | No | https://timebook-app.azurestaticapps.net |
| WEBSITES_PORT | Yes | 8080 |

### Frontend (Static Web App build)

| Variable | Required | Example |
|----------|----------|---------|
| VITE_API_URL | Yes | https://timebook-api.azurewebsites.net/api |
| VITE_BASE_URL | No | / |

---

## Cost Estimate (Monthly, Approximate)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| PostgreSQL Flexible Server | Burstable B1ms | ~$15–25 |
| App Service | B1 | ~$13 |
| Static Web Apps | Free | $0 |
| Container Registry | Basic | ~$5 |
| **Total** | | **~$35–45** |

Free tier options: Use Azure Database for PostgreSQL **Flexible Server** with smallest Burstable tier, and **Free** Static Web Apps. App Service has a Free (F1) tier with limitations.

---

## Troubleshooting

### Backend won't start
- Check App Service logs: **Monitoring** → **Log stream**
- Verify `WEBSITES_PORT=8080` is set
- Ensure database firewall allows App Service IPs

### CORS errors in browser
- Add exact frontend URL to `CORS_ALLOWED_ORIGINS` (no trailing slash)
- Restart the backend after changing settings

### Database connection failed
- Use `sslmode=require` for Azure PostgreSQL
- Check firewall rules allow Azure services
- Verify credentials in App Service configuration

### Migrations fail
- Run from a machine with network access to Azure PostgreSQL
- Or add migration script to backend Docker image and run on startup

---

## Quick Deploy Script (Summary)

```bash
# 1. Create resources
az group create -n timebook-rg -l eastus
az postgres flexible-server create -g timebook-rg -n timebook-db ...
az acr create -g timebook-rg -n timebookacr --sku Basic
az appservice plan create -g timebook-rg -n timebook-plan --is-linux -k B1
az webapp create -g timebook-rg -p timebook-plan -n timebook-api ...

# 2. Build & push
docker build -f Dockerfile.backend -t timebookacr.azurecr.io/timebook-backend:latest .
docker push timebookacr.azurecr.io/timebook-backend:latest

# 3. Configure & deploy
az webapp config appsettings set ...
az webapp config container set ...

# 4. Run migrations (from local)
migrate -path backend/migrations -database "postgres://..." up
```

---

## Support

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Azure Static Web Apps Docs](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure Database for PostgreSQL Docs](https://docs.microsoft.com/azure/postgresql/)

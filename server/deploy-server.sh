#!/bin/bash

# IEBA Server Deployment Script
# Deploys the Node.js server to Azure App Service (Free Tier)

# Configuration
RESOURCE_GROUP="ieba-resources"
LOCATION="centralus"
PLAN_NAME="ieba-server-plan-free"
APP_NAME="ieba-server-$(date +%s)" # Unique name using timestamp
RUNTIME="NODE:18-lts"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment for IEBA Server...${NC}"

# 1. Login check
echo -e "${YELLOW}Checking Azure login status...${NC}"
az account show > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Please login to Azure first:"
    az login
fi

# 2. Create Resource Group
echo -e "${YELLOW}Creating Resource Group '$RESOURCE_GROUP'...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION

# 3. Create App Service Plan (Free Tier)
echo -e "${YELLOW}Creating App Service Plan '$PLAN_NAME' (Free Tier)...${NC}"
az appservice plan create \
    --name $PLAN_NAME \
    --resource-group $RESOURCE_GROUP \
    --sku F1 \
    --is-linux

# 4. Create Web App
echo -e "${YELLOW}Creating Web App '$APP_NAME'...${NC}"
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan $PLAN_NAME \
    --name $APP_NAME \
    --runtime $RUNTIME

# 5. Configure Environment Variables (Cosmos DB)
# Read from .env file
if [ -f .env ]; then
    export $(cat .env | xargs)
    echo -e "${YELLOW}Configuring App Settings from .env...${NC}"
    
    az webapp config appsettings set \
        --resource-group $RESOURCE_GROUP \
        --name $APP_NAME \
        --settings \
        COSMOS_DB_ENDPOINT="$COSMOS_DB_ENDPOINT" \
        COSMOS_DB_KEY="$COSMOS_DB_KEY" \
        COSMOS_DB_DATABASE="$COSMOS_DB_DATABASE" \
        COSMOS_DB_CONTAINER="$COSMOS_DB_CONTAINER" \
        SCM_DO_BUILD_DURING_DEPLOYMENT="true"
else
    echo "Error: .env file not found!"
    exit 1
fi

# 6. Deploy Code
echo -e "${YELLOW}Deploying code to '$APP_NAME'...${NC}"
# Create a zip of the current directory, excluding node_modules and other unnecessary files
zip -r deploy.zip . -x "node_modules/*" ".git/*" ".env" "deploy-server.sh"

# Deploy the zip file
az webapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --src deploy.zip

# Cleanup zip
rm deploy.zip

# 7. Output Result
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "Server URL: https://$APP_NAME.azurewebsites.net"
echo -e "API Endpoint: https://$APP_NAME.azurewebsites.net/api/employees"

echo -e "${YELLOW}IMPORTANT: Update your bot/.env with this new URL!${NC}"
echo "API_ENDPOINT=https://$APP_NAME.azurewebsites.net"

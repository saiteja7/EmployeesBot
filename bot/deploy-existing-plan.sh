#!/bin/bash

# Deploy to EXISTING App Service Plan (No quota needed!)
set -e

echo "🚀 Deploying to existing App Service Plan..."

# Configuration
RESOURCE_GROUP="react-router_group"  # Existing resource group
APP_SERVICE_PLAN="ASP-reactroutergroup-8221"  # Existing plan
APP_SERVICE_NAME="ieba-bot-app"
BOT_NAME="ieba-bot"
BOT_RESOURCE_GROUP="ieba-rg"  # New RG for bot service only

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed."
    exit 1
fi

# Login to Azure
echo "🔐 Logging into Azure..."
az login

# Create App Service using EXISTING plan
echo "🌐 Creating App Service on existing plan..."
az webapp create \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE:18-lts"

# Configure environment variables
echo "⚙️  Configuring environment variables..."
az webapp config appsettings set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    COSMOS_DB_ENDPOINT="$COSMOS_DB_ENDPOINT" \
    COSMOS_DB_KEY="$COSMOS_DB_KEY" \
    COSMOS_DB_DATABASE="ieba-db" \
    COSMOS_DB_CONTAINER="employees" \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_KEY="$AZURE_OPENAI_KEY" \
    AZURE_OPENAI_DEPLOYMENT="gpt-35-turbo" \
    API_ENDPOINT="http://localhost:3000" \
    MicrosoftAppId="" \
    MicrosoftAppPassword=""

# Deploy bot code
echo "📤 Deploying bot code..."
cd "$(dirname "$0")"
zip -r bot-deploy.zip . -x "node_modules/*" -x ".git/*" -x "*.log"

az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --src bot-deploy.zip

rm bot-deploy.zip

# Create resource group for bot service
echo "📦 Creating resource group for bot service..."
az group create --name $BOT_RESOURCE_GROUP --location eastus

# Create Azure Bot
echo "🤖 Creating Azure Bot Service..."
az bot create \
  --resource-group $BOT_RESOURCE_GROUP \
  --name $BOT_NAME \
  --kind webapp \
  --endpoint "https://${APP_SERVICE_NAME}.azurewebsites.net/api/messages"

# Enable Direct Line channel
echo "📡 Enabling Direct Line channel..."
az bot directline create \
  --name $BOT_NAME \
  --resource-group $BOT_RESOURCE_GROUP

# Get Direct Line secret
echo "🔑 Getting Direct Line secret..."
DIRECT_LINE_SECRET=$(az bot directline show \
  --name $BOT_NAME \
  --resource-group $BOT_RESOURCE_GROUP \
  --with-secrets true \
  --query "properties.properties.sites[0].key" -o tsv)

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Deployment Details:"
echo "   Resource Group (App): $RESOURCE_GROUP"
echo "   Resource Group (Bot): $BOT_RESOURCE_GROUP"
echo "   App Service: https://${APP_SERVICE_NAME}.azurewebsites.net"
echo "   Bot Endpoint: https://${APP_SERVICE_NAME}.azurewebsites.net/api/messages"
echo ""
echo "🔑 Direct Line Secret:"
echo "   $DIRECT_LINE_SECRET"
echo ""
echo "💰 Cost: FREE (using existing App Service Plan)"

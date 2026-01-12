#!/bin/bash

# Azure Bot Deployment Script
# This script deploys the IEBA bot to Azure App Service

set -e

echo "🚀 Starting Azure Bot Deployment..."

# Configuration
RESOURCE_GROUP="ieba-rg"
LOCATION="eastus"
BOT_NAME="ieba-bot"
APP_SERVICE_PLAN="ieba-plan"
APP_SERVICE_NAME="ieba-bot-app"
SERVER_URL="http://localhost:3000"  # Update this if server is deployed separately

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Login to Azure
echo "🔐 Logging into Azure..."
az login

# Create Resource Group
echo "📦 Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create App Service Plan (Linux, Free tier)
echo "📋 Creating App Service Plan (Free tier)..."
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku F1 \
  --is-linux

# Create App Service
echo "🌐 Creating App Service..."
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
    API_ENDPOINT="$SERVER_URL" \
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

# Create Azure Bot
echo "🤖 Creating Azure Bot Service..."
az bot create \
  --resource-group $RESOURCE_GROUP \
  --name $BOT_NAME \
  --kind webapp \
  --endpoint "https://${APP_SERVICE_NAME}.azurewebsites.net/api/messages"

# Enable Direct Line channel
echo "📡 Enabling Direct Line channel..."
az bot directline create \
  --name $BOT_NAME \
  --resource-group $RESOURCE_GROUP

# Get Direct Line secret
echo "🔑 Getting Direct Line secret..."
DIRECT_LINE_SECRET=$(az bot directline show \
  --name $BOT_NAME \
  --resource-group $RESOURCE_GROUP \
  --with-secrets true \
  --query "properties.properties.sites[0].key" -o tsv)

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Deployment Details:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Bot Name: $BOT_NAME"
echo "   App Service: https://${APP_SERVICE_NAME}.azurewebsites.net"
echo "   Bot Endpoint: https://${APP_SERVICE_NAME}.azurewebsites.net/api/messages"
echo ""
echo "🔑 Direct Line Secret:"
echo "   $DIRECT_LINE_SECRET"
echo ""
echo "⚠️  Save this secret securely! You'll need it for the web chat client."
echo ""
echo "🌐 Test your bot at: https://portal.azure.com"

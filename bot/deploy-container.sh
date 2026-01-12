#!/bin/bash

# Azure Container Instance Deployment (No Quota Required!)
set -e

echo "🚀 Starting Azure Container Instance Deployment..."

# Configuration
RESOURCE_GROUP="ieba-rg"
LOCATION="eastus"
BOT_NAME="ieba-bot"
CONTAINER_NAME="ieba-bot-container"
ACR_NAME="iebaregistry$(date +%s)"  # Unique name
IMAGE_NAME="ieba-bot:latest"

# Check if resource group exists, if not create it
if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo "📦 Creating resource group..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
else
    echo "✓ Resource group already exists"
fi

# Create Azure Container Registry
echo "📦 Creating Azure Container Registry..."
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Get ACR credentials
echo "🔑 Getting ACR credentials..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)

# Build and push Docker image
echo "🐳 Building Docker image..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME \
  --file Dockerfile \
  .

# Deploy to Azure Container Instance
echo "🌐 Deploying to Azure Container Instance..."
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --image ${ACR_LOGIN_SERVER}/${IMAGE_NAME} \
  --registry-login-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --dns-name-label ieba-bot-${RANDOM} \
  --ports 3978 \
  --environment-variables \
    COSMOS_DB_ENDPOINT="$COSMOS_DB_ENDPOINT" \
    COSMOS_DB_DATABASE="ieba-db" \
    COSMOS_DB_CONTAINER="employees" \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_DEPLOYMENT="gpt-35-turbo" \
    API_ENDPOINT="http://localhost:3000" \
  --secure-environment-variables \
    COSMOS_DB_KEY="$COSMOS_DB_KEY" \
    AZURE_OPENAI_KEY="$AZURE_OPENAI_KEY"

# Get container FQDN
FQDN=$(az container show \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --query ipAddress.fqdn -o tsv)

BOT_ENDPOINT="http://${FQDN}:3978/api/messages"

echo "Container deployed at: $FQDN"

# Create Azure Bot
echo "🤖 Creating Azure Bot Service..."
az bot create \
  --resource-group $RESOURCE_GROUP \
  --name $BOT_NAME \
  --kind webapp \
  --endpoint $BOT_ENDPOINT

# Enable Direct Line
echo "📡 Enabling Direct Line..."
az bot directline create \
  --name $BOT_NAME \
  --resource-group $RESOURCE_GROUP

# Get Direct Line secret
DIRECT_LINE_SECRET=$(az bot directline show \
  --name $BOT_NAME \
  --resource-group $RESOURCE_GROUP \
  --with-secrets true \
  --query "properties.properties.sites[0].key" -o tsv)

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Details:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Container: $FQDN"
echo "   Bot Endpoint: $BOT_ENDPOINT"
echo ""
echo "🔑 Direct Line Secret:"
echo "   $DIRECT_LINE_SECRET"
echo ""
echo "💰 Cost: ~$10-15/month (Container Instance + ACR)"

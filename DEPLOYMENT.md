# Azure Bot Deployment Guide

## Prerequisites

1. **Azure CLI** installed and configured
   ```bash
   az --version
   ```

2. **Environment Variables** - Set these before running deployment:
   ```bash
   export COSMOS_DB_ENDPOINT="https://employeedb1996.documents.azure.com:443/"
   export COSMOS_DB_KEY="your-cosmos-key"
   export AZURE_OPENAI_ENDPOINT="https://ragopenapi.openai.azure.com/"
   export AZURE_OPENAI_KEY="your-openai-key"
   ```

## Deployment Steps

### 1. Deploy Bot to Azure

```bash
cd /Users/saitejasrirambhatla/Documents/code/practice_projects/ieba-system/bot

# Run deployment script
./deploy-azure.sh
```

This script will:
- Create Azure Resource Group
- Create App Service Plan (B1 tier)
- Create App Service for bot
- Deploy bot code
- Create Azure Bot Service
- Enable Direct Line channel
- Display Direct Line secret

### 2. Save Direct Line Secret

After deployment, you'll see output like:
```
🔑 Direct Line Secret:
   abc123xyz456...
```

**Save this secret!** You'll need it for the web chat client.

### 3. Configure Web Chat Client

```bash
cd /Users/saitejasrirambhatla/Documents/code/practice_projects/ieba-system/client

# Create .env file
cp .env.example .env

# Edit .env and add your Direct Line secret
nano .env
```

Add:
```
REACT_APP_DIRECT_LINE_SECRET=your_actual_secret_here
```

### 4. Install Web Chat Dependencies

```bash
npm install botframework-webchat
```

### 5. Update App.jsx

Import and use the BotChat component:

```javascript
import BotChat from './components/BotChat';

function App() {
  return (
    <div className="App">
      <BotChat />
    </div>
  );
}
```

### 6. Test Locally

```bash
npm start
```

Open http://localhost:5173 and test the bot chat.

## Verify Deployment

### Check Bot Endpoint

```bash
curl https://ieba-bot-app.azurewebsites.net/api/messages
```

### Check Azure Portal

1. Go to https://portal.azure.com
2. Navigate to Resource Group: `ieba-rg`
3. Check:
   - App Service: `ieba-bot-app`
   - Azure Bot: `ieba-bot`
   - Direct Line channel is enabled

### Test in Bot Framework Emulator

1. Download: https://github.com/microsoft/BotFramework-Emulator
2. Open bot with endpoint: `https://ieba-bot-app.azurewebsites.net/api/messages`

## Troubleshooting

### Bot not responding

Check App Service logs:
```bash
az webapp log tail --name ieba-bot-app --resource-group ieba-rg
```

### Direct Line connection failed

1. Verify secret is correct
2. Check bot endpoint is accessible
3. Ensure Direct Line channel is enabled

### API endpoint not reachable

If server is deployed separately, update environment variable:
```bash
az webapp config appsettings set \
  --name ieba-bot-app \
  --resource-group ieba-rg \
  --settings API_ENDPOINT="https://your-server-url.com"
```

## Clean Up

To delete all Azure resources:

```bash
az group delete --name ieba-rg --yes --no-wait
```

## Cost Management

- **App Service B1**: ~$13/month
- **Azure Bot Service**: Free (up to 10,000 messages/month)
- **Direct Line**: Included in Bot Service
- **Total**: ~$13-20/month

## Next Steps

1. Deploy server API to Azure (optional)
2. Configure custom domain
3. Enable SSL/TLS
4. Set up monitoring and alerts
5. Configure auto-scaling

import crypto from 'crypto';
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}

import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
dotenv.config();

const cosmosClient = new CosmosClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT,
    key: process.env.COSMOS_DB_KEY
});

const databaseId = process.env.COSMOS_DB_DATABASE || 'ieba-db';
const containerId = process.env.COSMOS_DB_CONTAINER || 'employees';

async function fixKeys() {
    const database = cosmosClient.database(databaseId);
    const container = database.container(containerId);

    console.log('Fetching all items...');
    const { resources: items } = await container.items.readAll().fetchAll();
    console.log(`Found ${items.length} items.`);

    for (const item of items) {
        const newItem = {};
        let changed = false;

        Object.keys(item).forEach(key => {
            const trimmedKey = key.trim();
            if (trimmedKey !== key) {
                changed = true;
            }
            newItem[trimmedKey] = item[key];
        });

        if (changed) {
            console.log(`Updating item ${item.id} (trimmed keys)...`);
            // Remove system fields before replace if they were trimmed (they shouldn't be, but just in case)
            // Actually replace handles them if they are correct.
            await container.item(item.id, item.id).replace(newItem);
        }
    }

    console.log('Done!');
}

fixKeys().catch(console.error);

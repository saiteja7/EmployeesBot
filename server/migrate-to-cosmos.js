// Polyfill for crypto in Node.js v18
import crypto from 'crypto';
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}

import { CosmosClient } from '@azure/cosmos';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cosmos DB Setup
const cosmosClient = new CosmosClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT,
    key: process.env.COSMOS_DB_KEY
});

const databaseId = process.env.COSMOS_DB_DATABASE || 'ieba-db';
const containerId = process.env.COSMOS_DB_CONTAINER || 'employees';

async function migrateData() {
    try {
        console.log('Starting migration from LowDB to Cosmos DB...');

        // Read data from LowDB
        const dbFile = path.join(__dirname, 'db.json');
        const adapter = new JSONFile(dbFile);
        const db = new Low(adapter, { employees: [] });
        await db.read();

        const employees = db.data.employees || [];
        console.log(`Found ${employees.length} employees in LowDB`);

        if (employees.length === 0) {
            console.log('No data to migrate');
            return;
        }

        // Connect to Cosmos DB
        const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
        console.log(`Connected to database: ${databaseId}`);

        const { container } = await database.containers.createIfNotExists({
            id: containerId,
            partitionKey: { paths: ['/id'] }
        });
        console.log(`Connected to container: ${containerId}`);

        // Migrate each employee
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < employees.length; i++) {
            const employee = employees[i];

            // Generate unique ID if not present
            if (!employee.id) {
                const employeeName = employee['Employee Name'] || employee.Name || `Employee_${i}`;
                employee.id = employeeName.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now() + '_' + i;
            }

            try {
                await container.items.create(employee);
                successCount++;
                console.log(`Migrated ${successCount}/${employees.length}: ${employee['Employee Name'] || employee.id}`);
            } catch (error) {
                errorCount++;
                console.error(`Error migrating employee ${employee.id}:`, error.message);
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`Successfully migrated: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Total: ${employees.length}`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateData();

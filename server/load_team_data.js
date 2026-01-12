// Polyfill for crypto in Node.js v18
import crypto from 'crypto';
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}

import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function loadTeamData() {
    try {
        console.log('Loading team data into Cosmos DB...');

        // Read team data
        const dataPath = path.join(__dirname, 'team_employee_data.json');
        const teamData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const employees = teamData.employees;

        console.log(`Found ${employees.length} team members`);

        // Connect to Cosmos DB
        const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
        const { container } = await database.containers.createIfNotExists({
            id: containerId,
            partitionKey: { paths: ['/id'] }
        });

        // Delete existing data
        console.log('Clearing existing data...');
        const { resources: existingEmployees } = await container.items.readAll().fetchAll();
        for (const emp of existingEmployees) {
            await container.item(emp.id, emp.id).delete();
        }
        console.log(`Deleted ${existingEmployees.length} existing records`);

        // Insert team data
        let insertedCount = 0;
        for (const employee of employees) {
            // Generate unique ID
            const employeeName = employee['Employee Name'];
            employee.id = employeeName.replace(/\s+/g, '_').toLowerCase();

            await container.items.create(employee);
            insertedCount++;
            console.log(`✅ Loaded ${insertedCount}/${employees.length}: ${employeeName}`);
        }

        console.log('\n🎉 Team data loaded successfully!');
        console.log(`📊 Total: ${insertedCount} employees`);

    } catch (error) {
        console.error('❌ Failed to load team data:', error);
        process.exit(1);
    }
}

loadTeamData();

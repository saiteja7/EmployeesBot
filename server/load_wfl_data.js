// Polyfill for crypto in Node.js v18
import crypto from 'crypto';
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}

import { CosmosClient } from '@azure/cosmos';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
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

async function loadWFLData() {
    try {
        console.log('🔍 Loading WFL Excel data...');

        // Read Excel file from uploads folder
        const filePath = path.join(__dirname, 'uploads', 'WFL_filled_final.xlsx');
        console.log(`📂 Reading file: ${filePath}`);

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`✅ Found ${data.length} records in Excel`);
        console.log(`📄 Sheet: ${sheetName}`);

        // Show sample columns
        if (data.length > 0) {
            console.log('\n📋 Columns found:');
            const columns = Object.keys(data[0]);
            columns.forEach((col, idx) => {
                if (idx < 15) console.log(`   ${idx + 1}. ${col}`);
            });
            console.log(`   ... and ${columns.length - 15} more columns (${columns.length} total)`);
        }

        // Connect to Cosmos DB
        console.log('\n🔗 Connecting to Cosmos DB...');
        const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
        const { container } = await database.containers.createIfNotExists({
            id: containerId,
            partitionKey: { paths: ['/id'] }
        });
        console.log(`   Connected to ${databaseId}/${containerId}`);

        // Clear existing data
        console.log('\n🗑️  Clearing existing data...');
        const { resources: existingEmployees } = await container.items.readAll().fetchAll();
        for (const emp of existingEmployees) {
            await container.item(emp.id, emp.id).delete();
        }
        console.log(`   Deleted ${existingEmployees.length} existing records`);

        // Insert WFL data
        console.log('\n📥 Loading data into Cosmos DB...');
        let insertedCount = 0;
        let errors = 0;

        for (let i = 0; i < data.length; i++) {
            const record = data[i];

            try {
                // Generate unique ID from Name and SOW No
                const employeeName = record['Name'] || `Employee_${i}`;
                const sowNo = record['SOW No'] || i;
                record.id = `${employeeName}_${sowNo}`.replace(/[\s\/\\:*?"<>|]/g, '_').toLowerCase();

                // Ensure all fields are preserved exactly as they are
                await container.items.create(record);
                insertedCount++;

                if (insertedCount % 50 === 0 || insertedCount === data.length) {
                    console.log(`   ✅ Loaded ${insertedCount}/${data.length} records`);
                }
            } catch (error) {
                errors++;
                console.error(`   ❌ Error loading record ${i}: ${error.message}`);
            }
        }

        console.log('\n🎉 WFL Data loaded successfully!');
        console.log(`📊 Total records: ${insertedCount}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`💾 Database: ${databaseId}/${containerId}`);

        // Show sample record structure
        if (insertedCount > 0) {
            console.log('\n📝 Sample record fields:');
            const sampleFields = Object.keys(data[0]);
            console.log(`   Total fields: ${sampleFields.length}`);
        }

    } catch (error) {
        console.error('❌ Failed to load WFL data:', error);
        process.exit(1);
    }
}

loadWFLData();

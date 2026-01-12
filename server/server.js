// Polyfill for crypto in Node.js v18
import crypto from 'crypto';
if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto;
}

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CosmosClient } from '@azure/cosmos';
import xlsx from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Cosmos DB Setup
const cosmosClient = new CosmosClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT,
    key: process.env.COSMOS_DB_KEY
});

const databaseId = process.env.COSMOS_DB_DATABASE || 'ieba-db';
const containerId = process.env.COSMOS_DB_CONTAINER || 'employees';

let database;
let container;

// Initialize Cosmos DB
async function initCosmosDB() {
    try {
        // Create database if it doesn't exist
        const { database: db } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
        database = db;
        console.log(`Database '${databaseId}' ready`);

        // Create container if it doesn't exist
        const { container: cont } = await database.containers.createIfNotExists({
            id: containerId,
            partitionKey: { paths: ['/id'] }
        });
        container = cont;
        console.log(`Container '${containerId}' ready`);
    } catch (error) {
        console.error('Error initializing Cosmos DB:', error);
        throw error;
    }
}

// File Upload Setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'billing_data.xlsx');
    }
});
const upload = multer({ storage: storage });

// Routes

// Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        const { resources: employees } = await container.items
            .readAll()
            .fetchAll();
        res.json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// Query employees with Cosmos DB SQL (for AI-driven filtering)
app.post('/api/employees/query', async (req, res) => {
    try {
        const { sqlQuery } = req.body;

        if (!sqlQuery) {
            return res.status(400).json({ error: 'SQL query is required' });
        }

        console.log('Executing Cosmos DB query:', sqlQuery);

        // Execute the SQL query
        const { resources: employees } = await container.items
            .query(sqlQuery)
            .fetchAll();

        console.log(`Query returned ${employees.length} records`);
        res.json(employees);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({
            error: 'Failed to execute query',
            details: error.message
        });
    }
});

// Add employee (for testing/seeding)
app.post('/api/employees', async (req, res) => {
    try {
        const newEmployee = req.body;

        // Generate unique ID if not provided
        if (!newEmployee.id) {
            newEmployee.id = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        const { resource: createdEmployee } = await container.items.create(newEmployee);
        res.status(201).json(createdEmployee);
    } catch (error) {
        console.error('Error adding employee:', error);
        res.status(500).json({ error: 'Failed to add employee' });
    }
});

// Get employee by ID
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { resource: employee } = await container.item(id, id).read();

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json(employee);
    } catch (error) {
        if (error.code === 404) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;

        // Ensure the ID in the body matches the URL parameter
        updatedData.id = id;

        const { resource: updatedEmployee } = await container
            .item(id, id)
            .replace(updatedData);

        res.json(updatedEmployee);
    } catch (error) {
        if (error.code === 404) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});

// Patch employee (partial update)
app.patch('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // First, fetch the existing employee
        const { resource: existingEmployee } = await container.item(id, id).read();

        if (!existingEmployee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Merge updates with existing data
        const updatedEmployee = { ...existingEmployee, ...updates, id }; // Ensure ID doesn't change

        // Replace with merged data
        const { resource: result } = await container
            .item(id, id)
            .replace(updatedEmployee);

        res.json(result);
    } catch (error) {
        if (error.code === 404) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        console.error('Error patching employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await container.item(id, id).delete();

        res.json({ message: 'Employee deleted successfully', id });
    } catch (error) {
        if (error.code === 404) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
});

// Upload Excel
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        // Parse the uploaded Excel file
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Trim all keys (column headers)
        const data = rawData.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => {
                newRow[key.trim()] = row[key];
            });
            return newRow;
        });

        // Delete all existing employees
        const { resources: existingEmployees } = await container.items.readAll().fetchAll();
        for (const emp of existingEmployees) {
            await container.item(emp.id, emp.id).delete();
        }

        // Insert new employees with unique IDs
        let insertedCount = 0;
        for (const employee of data) {
            // Generate unique ID based on Employee Name or index
            const employeeName = employee['Employee Name'] || employee.Name || `Employee_${insertedCount}`;
            employee.id = employeeName.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now() + '_' + insertedCount;

            await container.items.create(employee);
            insertedCount++;
        }

        res.send({
            message: 'File uploaded and parsed successfully',
            path: req.file.path,
            employeeCount: insertedCount
        });
    } catch (error) {
        console.error('Error parsing Excel file:', error);
        res.status(500).send({ message: 'Error parsing Excel file', error: error.message });
    }
});

// Start Server
async function startServer() {
    try {
        await initCosmosDB();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Connected to Cosmos DB: ${databaseId}/${containerId}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

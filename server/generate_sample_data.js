import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = [
    { EmployeeID: 'E001', Name: 'Alice Smith', Department: 'Engineering', Role: 'Senior Dev', Project: 'Alpha', BillableHours: 40, Rate: 150, Date: '2023-10-01' },
    { EmployeeID: 'E002', Name: 'Bob Jones', Department: 'Engineering', Role: 'Junior Dev', Project: 'Alpha', BillableHours: 35, Rate: 100, Date: '2023-10-01' },
    { EmployeeID: 'E003', Name: 'Charlie Brown', Department: 'Design', Role: 'Designer', Project: 'Beta', BillableHours: 20, Rate: 120, Date: '2023-10-02' },
    { EmployeeID: 'E004', Name: 'Diana Prince', Department: 'Product', Role: 'Product Owner', Project: 'Beta', BillableHours: 45, Rate: 160, Date: '2023-10-02' },
    { EmployeeID: 'E005', Name: 'Evan Wright', Department: 'Engineering', Role: 'DevOps', Project: 'Gamma', BillableHours: 30, Rate: 140, Date: '2023-10-03' },
    { EmployeeID: 'E001', Name: 'Alice Smith', Department: 'Engineering', Role: 'Senior Dev', Project: 'Alpha', BillableHours: 42, Rate: 150, Date: '2023-10-08' },
    { EmployeeID: 'E002', Name: 'Bob Jones', Department: 'Engineering', Role: 'Junior Dev', Project: 'Alpha', BillableHours: 38, Rate: 100, Date: '2023-10-08' },
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

const filePath = path.join(__dirname, 'sample_data.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`Sample data generated at: ${filePath}`);

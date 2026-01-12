import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Team members data
const teamMembers = [
    { name: "Anitha Museni", companyLevel: "3P", clientRequired: "2P", clientAssessed: "2P", scenario: "loss" },
    { name: "Arpit Chandak", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Ashish Poddar", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Bappi Modak", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Kali Rath", companyLevel: "3P", clientRequired: "3P", clientAssessed: "2P", scenario: "opportunity" },
    { name: "Nagarjuna MetlaDola", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Nimish Aggarwal", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Rutuja Dherange", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "SaiHaritha Dulugunti", companyLevel: "2P", clientRequired: "2P", clientAssessed: "2P", scenario: "match" },
    { name: "SaiTeja Srirambhatla", companyLevel: "3P", clientRequired: "3P", clientAssessed: "2P", scenario: "opportunity" },
    { name: "Swaraj Inukonda", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Tejesh Surabathula", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" },
    { name: "Vidhyadhari Alapati", companyLevel: "3P", clientRequired: "3P", clientAssessed: "3P", scenario: "match" }
];

const skills = ["Java", "Python", "React", "Node.js", "AWS", "Azure", "SQL", "MongoDB", "Docker", "Kubernetes"];
const levelRates = {
    "1P": { min: 8000, rate: 50 },
    "2P": { min: 12800, rate: 80 },
    "3P": { min: 19200, rate: 120 }
};

function getRandomSkills() {
    const count = Math.floor(Math.random() * 3) + 1; // 1-3 skills
    const shuffled = [...skills].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).join(", ");
}

function generateBillingAmount(clientAssessed, scenario) {
    const baseRate = levelRates[clientAssessed];
    const hours = Math.floor(Math.random() * 30) + 140; // 140-170 hours

    // Calculate based on client assessed level
    let amount = hours * baseRate.rate;

    // Add some variance
    const variance = (Math.random() - 0.5) * 0.1; // ±5%
    amount = Math.floor(amount * (1 + variance));

    return { amount, hours };
}

const employees = teamMembers.map((member, index) => {
    const { amount, hours } = generateBillingAmount(member.clientAssessed, member.scenario);
    const experience = Math.floor(Math.random() * 10) + 3; // 3-12 years

    return {
        "Employee Name": member.name,
        "Company Level": member.companyLevel,
        "Minimum Billable Amount": levelRates[member.companyLevel].min,
        "Actual Client Bill Amount": amount,
        "Billable Hours": hours,
        "Client Required Level": member.clientRequired,
        "Client Assessed Level": member.clientAssessed,
        "Skills": getRandomSkills(),
        "Years of Experience": experience,
        "isHired": true
    };
});

// Create Excel file
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(employees);

XLSX.utils.book_append_sheet(wb, ws, 'Employees');

const filePath = path.join(__dirname, 'team_employee_data.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`✅ Generated ${employees.length} employee records`);
console.log(`📁 File saved: ${filePath}`);
console.log('\n📊 Scenario Breakdown:');
console.log(`   - Perfect Match: ${employees.filter(e => e['Client Required Level'] === e['Client Assessed Level'] && e['Company Level'] === e['Client Assessed Level']).length}`);
console.log(`   - Opportunity (3P→2P assessed): ${employees.filter(e => e['Company Level'] === '3P' && e['Client Required Level'] === '3P' && e['Client Assessed Level'] === '2P').length}`);
console.log(`   - Loss (3P company, 2P required & assessed): ${employees.filter(e => e['Company Level'] === '3P' && e['Client Required Level'] === '2P' && e['Client Assessed Level'] === '2P').length}`);

// Also save as JSON for easy viewing
const jsonPath = path.join(__dirname, 'team_employee_data.json');
fs.writeFileSync(jsonPath, JSON.stringify({ employees }, null, 2));
console.log(`📄 JSON saved: ${jsonPath}`);

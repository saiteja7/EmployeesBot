const { ActivityHandler } = require('botbuilder');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class IEBABot extends ActivityHandler {
    constructor() {
        super();

        // Initialize Azure OpenAI client
        this.openAIClient = new OpenAIClient(
            process.env.AZURE_OPENAI_ENDPOINT,
            new AzureKeyCredential(process.env.AZURE_OPENAI_KEY)
        );
        this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

        this.onMessage(async (context, next) => {
            const userQuery = context.activity.text;

            try {
                // Send typing indicator
                await context.sendActivity({ type: 'typing' });

                // STEP 1: Generate Cosmos DB query from user question
                const cosmosQuery = await this.generateCosmosQuery(userQuery);
                console.log('Generated Cosmos DB query:', cosmosQuery);

                // STEP 2: Fetch only relevant data using the generated query
                let relevantData = await this.loadEmployeeData(cosmosQuery);
                if (relevantData) {
                    console.log(`Fetched ${relevantData.length} relevant records`);
                }

                // FALLBACK: If specific query returns no data or fails (null), try fetching ALL data
                // This handles cases where the SQL filter was too restrictive or incorrect
                if (!relevantData || relevantData.length === 0) {
                    console.log('⚠️ No records found or query failed. Falling back to fetching ALL data...');
                    relevantData = await this.loadEmployeeData('SELECT * FROM c');
                    if (relevantData) {
                        console.log(`Fallback fetched ${relevantData.length} records`);
                    }
                }

                if (!relevantData || relevantData.length === 0) {
                    await context.sendActivity("I couldn't find any data in the system. Please check if the database is empty.");
                    await next();
                    return;
                }

                // STEP 3: Get intelligent response using only the filtered data
                const response = await this.getIntelligentResponse(userQuery, relevantData);

                await context.sendActivity(response);
            } catch (error) {
                console.error('Error processing message:', error);
                await context.sendActivity('Sorry, I encountered an error processing your request. Please try again.');
            }

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    const welcomeMessage = `Hello! 👋 I'm your Intelligent Employee & Billing Analyst.

I can help you with:
• Employee billing information
• Profit/loss analysis (individual or organization-wide)
• Skill-based queries
• Performance metrics
• Financial summaries

Try asking me:
- "What's the billing for Employee 5?"
- "Show me all employees with negative profit"
- "Calculate total profit for the organization"
- "Which Java developers are below minimum billable?"`;

                    await context.sendActivity(welcomeMessage);
                }
            }
            await next();
        });
    }

    async generateCosmosQuery(userQuery) {
        const currentDate = new Date().toDateString();
        const currentYear = new Date().getFullYear();
        const lastYear = currentYear - 1;

        // Excel Serial Date Ranges (Approximate)
        // 2023: 44927 - 45291
        // 2024: 45292 - 45657
        // 2025: 45658 - 46022
        // 2026: 46023 - 46387

        const startOfCurrentYear = Math.floor((new Date(currentYear, 0, 1) - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24));
        const endOfCurrentYear = Math.floor((new Date(currentYear, 11, 31) - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24));
        const startOfLastYear = Math.floor((new Date(lastYear, 0, 1) - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24));
        const endOfLastYear = Math.floor((new Date(lastYear, 11, 31) - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24));

        // System prompt to teach AI how to generate Cosmos DB SQL queries
        const queryGenerationPrompt = `You are a Cosmos DB SQL query generator for a workforce billing system.

CURRENT DATE: ${currentDate}
Current Year: ${currentYear} (Excel Serial Range: ${startOfCurrentYear} - ${endOfCurrentYear})
Last Year: ${lastYear} (Excel Serial Range: ${startOfLastYear} - ${endOfLastYear})

DATABASE SCHEMA (WFL Data):
- Name: Employee name
- SOW No: SOW number
- Team Name: Team name
- Job Level: Company level (1P, 2P, 3P)
- SOW Level: SOW agreed level
- Billed Level: Actual billed level
- ARR Value: Annual Recurring Revenue
- Billing Rate: Billing rate
- Resource start date: Start date (EXCEL SERIAL NUMBER, e.g., 45291)
- Resource End Date: End date (EXCEL SERIAL NUMBER, e.g., 46021)
- Status: Active/Inactive status
- Possible Attrition: Attrition risk (Yes/No)
- Revenue Miss: Revenue miss flag
- Identified Backup: Backup resource name

DECISION LOGIC FOR HYBRID QUERIES:

1. **STATIC FIELDS (Filter in SQL):**
   - If the query includes conditions on: Name, Team, Level, Date, Status, Attrition.
   - **ACTION:** Include these in the SQL WHERE clause.
   - **Time Queries:** 
     - "This year" -> c['Resource End Date'] >= ${startOfCurrentYear} AND c['Resource End Date'] <= ${endOfCurrentYear}
     - "Last year" -> c['Resource End Date'] >= ${startOfLastYear} AND c['Resource End Date'] <= ${endOfLastYear}

2. **CALCULATED FIELDS & AGGREGATIONS (Ignore in SQL):**
   - If the query includes: 
     - Profit, Loss, Margin, "Not making profit", "Upsell", "Efficiency".
     - "Minimum billing rate", "Below minimum".
     - **Aggregations:** "Most", "Least", "Count", "Total", "Average", "Group by".
   - **ACTION:** Do NOT attempt to filter, group, or sort these in SQL.
   - **CRITICAL:** Return exactly: SELECT * FROM c
   - (The intelligent system will handle all calculations, counting, and grouping).

3. **MIXED QUERIES (The Golden Rule):**
   - If user asks: "Profit this year"
   - **SQL:** Filter ONLY by Date. Ignore "Profit".
   - Query: SELECT * FROM c WHERE c['Resource End Date'] >= ${startOfCurrentYear} AND c['Resource End Date'] <= ${endOfCurrentYear}

EXAMPLES:

User: "Who is Saiteja?"
Query: SELECT * FROM c WHERE CONTAINS(LOWER(c.Name), 'saiteja')

User: "Which team has most employees?"
Query: SELECT * FROM c

User: "List employees below minimum billing rate"
Query: SELECT * FROM c

User: "Employees ending this year who are making profit"
Query: SELECT * FROM c WHERE c['Resource End Date'] >= ${startOfCurrentYear} AND c['Resource End Date'] <= ${endOfCurrentYear}

User: "Show profit for last year"
Query: SELECT * FROM c WHERE c['Resource End Date'] >= ${startOfLastYear} AND c['Resource End Date'] <= ${endOfLastYear}

User: "Show me upsell opportunities in Team Beta"
Query: SELECT * FROM c WHERE CONTAINS(LOWER(c['Team Name']), 'beta')

User: "Calculate total ARR for 3P employees"
Query: SELECT * FROM c WHERE c['SOW Level'] = '3P' OR c['Billed Level'] = '3P'

User: "Show me all 3P employees billed as 2P"
Query: SELECT * FROM c WHERE c['SOW Level'] = '3P' AND c['Billed Level'] = '2P'

User: "Which employees have attrition risk?"
Query: SELECT * FROM c WHERE CONTAINS(LOWER(c['Possible Attrition']), 'yes')

NOW GENERATE THE QUERY FOR THIS USER QUESTION. RETURN ONLY THE SQL QUERY:`;

        try {
            const messages = [
                { role: 'system', content: queryGenerationPrompt },
                { role: 'user', content: userQuery }
            ];

            const result = await this.openAIClient.getChatCompletions(
                this.deployment,
                messages,
                {
                    maxTokens: 200,
                    temperature: 0.1, // Very low temperature for consistent query generation
                    topP: 0.9
                }
            );

            if (result.choices && result.choices.length > 0) {
                let generatedQuery = result.choices[0].message.content.trim();

                // Clean up the response (remove markdown code blocks if present)
                generatedQuery = generatedQuery.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

                // Validate that it's a SELECT query and doesn't contain unsupported complex logic
                const upperQuery = generatedQuery.toUpperCase();
                if (!upperQuery.startsWith('SELECT')) {
                    console.warn('Generated query is not a SELECT statement, using fallback');
                    return 'SELECT * FROM c';
                }

                // CODE-LEVEL SAFETY NET:
                // If the query contains complex aggregations that Cosmos DB might reject or that we want JS to handle,
                // force a fallback to SELECT * FROM c.
                const complexKeywords = ['GROUP BY', 'ORDER BY', 'JOIN', 'COUNT(', 'SUM(', 'MIN(', 'MAX(', 'AVG('];
                if (complexKeywords.some(keyword => upperQuery.includes(keyword))) {
                    console.warn('Detected complex aggregation in SQL. Forcing fallback to SELECT * FROM c to let JS handle analysis.');
                    return 'SELECT * FROM c';
                }

                return generatedQuery;
            }

            // Fallback: return all records
            return 'SELECT * FROM c';
        } catch (error) {
            console.error('Error generating Cosmos query:', error);
            // Fallback: return all records
            return 'SELECT * FROM c';
        }
    }

    async loadEmployeeData(cosmosQuery) {
        try {
            const axios = require('axios');

            // Use environment variable for API endpoint (supports Azure deployment)
            const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000';

            // Use the new query endpoint with the generated SQL
            return await axios.post(`${API_ENDPOINT}/api/employees/query`, {
                sqlQuery: cosmosQuery
            })
                .then(response => response.data)
                .catch(err => {
                    console.log('Could not fetch from server:', err.message);
                    // Return null instead of throwing to allow fallback logic in onMessage
                    return null;
                });
        } catch (error) {
            console.error('Error loading employee data:', error);
            return null;
        }
    }

    async getIntelligentResponse(userQuery, employeeData) {
        // Create comprehensive system prompt for SOW/WFL data
        const systemPrompt = `You are an intelligent assistant for a Workforce & Billing Analysis system analyzing Statement of Work (SOW) data.

DATABASE SCHEMA (48+ fields):

**SOW Information:**
- Parent SOW: Parent statement of work
- SOW No: Actual SOW number
- Team Name: Team the employee belongs to
- Sub Team: Sub-team within main team
- Signed Date: SOW signing date
- Valid Till: SOW expiration date
- SOW Validity: Validity period
- SOW Quarter: Quarter of SOW signing

**Employee Information:**
- Name: Employee name
- Email: Employee email
- OPID: Employee ID
- Functional Manager: Manager name
- Resource start date: When employee started
- Resource End Date: When employee ends
- Status: Current status (Active, etc.)

**Level Analysis (CRITICAL):**
- Job Level: Company's internal understanding of employee level
- SOW Level: Level as per SOW agreement
- Billed Level: ACTUAL level company is billing at
- Internal Level: Internal assessment
- Client Assessed Level: How client views the employee

**Role & Capability:**
- Role- SOW: Role as per SOW
- Capability: Employee capability
- Capability Pillar: Capability category
- Capability- Actual: Actual capability
- Updated Capability: Updated capability info
- Title: Job title

**Financial Data:**
- ARR Positions: Annual Recurring Revenue positions
- ARR Value: ARR value in local currency
- ARR Value $Mn: ARR value in millions USD
- Billing Rate: Billing rate
- Billed At: What level billed at
- Hourly Rate: Hourly billing rate
- Positions: Number of positions
- Short Positions: Short-term positions
- Short Term Value: Short-term value
- Short Term Value $Mn: Short-term value in millions USD

**Resource Management:**
- Req ID: Requirement ID
- Engg/Ops: Engineering or Operations
- CG status: CG status
- CGID: CG identifier
- Transfer: Transfer status
- Remapped: Remapping status
- Possible Attrition: Attrition risk
- Identified Backup: Backup identified
- Internal Backup: Internal backup resource
- Backup start date: When backup starts
- IsNextquater: Next quarter flag
- Revenue Miss: Revenue miss flag
- Revenue Miss Backfill: Backfill for revenue miss

**BUSINESS LOGIC - LEVEL MISMATCH ANALYSIS:**

1. **Perfect Match:**
   - Job Level = SOW Level = Billed Level
   - Optimal scenario, no issues

2. **Overbilling Opportunity:**
   - Job Level > Billed Level
   - Example: Job Level 3P, Billed at 2P → Can upsell

3. **Underbilling Loss:**
   - SOW Level < Job Level AND Billed Level = SOW Level
   - Example: Job 3P, SOW 2P, Billed 2P → Giving senior resource for junior billing

4. **Client Perception Mismatch:**
   - Billed Level ≠ Client Assessed Level
   - May indicate client dissatisfaction or opportunity

**PROFIT/LOSS CALCULATIONS:**
- Revenue = ARR Value or Billing Rate × Hours
- Cost Benchmark (Minimum Billable):
  - 1P: ₹8,000 / $100
  - 2P: ₹12,800 / $160
  - 3P: ₹19,200 / $240
- Profit = Revenue - Cost Benchmark
- "Not making profit" = Revenue < Cost Benchmark OR Revenue Miss = "Yes"

**LEVEL HIERARCHY:**
1P < 2P < 3P (higher is more senior)

**YOUR TASKS:**
1. Understand complex SOW-related queries
2. Analyze across multiple dimensions (levels, teams, capabilities, dates)
3. Identify billing mismatches and opportunities
4. Calculate financial metrics (ARR, revenue, efficiency)
5. Provide actionable insights for resource optimization

**RESPONSE GUIDELINES:**
- Be concise and business-focused
- Use tables for multiple records
- Highlight revenue opportunities and risks
- Flag attrition risks and backup needs
- Include financial metrics when relevant
- Provide recommendations for optimization

**EXAMPLE QUERIES:**
- "Show employees with level mismatches" → Compare Job/SOW/Billed levels
- "Which SOWs expire soon?" → Check Valid Till dates
- "Calculate total ARR by team" → Sum ARR Value by Team Name
- "Find overbilling opportunities" → Job Level > Billed Level
- "Show attrition risks" → Filter Possible Attrition = Yes
- "Which employees need backups?" → Check Identified Backup status
- "Revenue miss analysis" → Filter Revenue Miss flags
- "Show me all 3P employees billed as 2P" → Level mismatch query`;

        // Optimize data payload: Send only necessary fields and remove empty values
        const optimizedData = employeeData.map(emp => {
            const cleanEmp = {};
            // Only include fields that have values and are relevant for analysis
            // Exclude system fields like _rid, _self, _etag, _attachments, _ts
            Object.keys(emp).forEach(key => {
                if (emp[key] !== null && emp[key] !== undefined && emp[key] !== '' && !key.startsWith('_')) {
                    cleanEmp[key] = emp[key];
                }
            });
            return cleanEmp;
        });

        // Prepare data summary for context
        let dataContext = '';
        const MAX_RECORDS = 25; // Limit records to prevent timeout

        if (optimizedData.length > MAX_RECORDS) {
            // For large datasets, send a simplified version AND truncate
            const criticalFields = ['Name', 'Team Name', 'Job Level', 'SOW Level', 'Billed Level', 'ARR Value', 'Billing Rate', 'Resource End Date', 'Revenue Miss', 'Possible Attrition', 'Resource start date'];

            const truncatedData = optimizedData.slice(0, MAX_RECORDS).map(emp => {
                const simple = {};
                criticalFields.forEach(field => {
                    if (emp[field]) simple[field] = emp[field];
                });
                return simple;
            });

            dataContext = `NOTE: Data truncated to first ${MAX_RECORDS} records (out of ${optimizedData.length}) to prevent timeout.
            
Simplified Data (Critical Fields Only):
${JSON.stringify(truncatedData, null, 2)}`;
        } else {
            dataContext = `Total Employees: ${optimizedData.length}\n\nFull Data:\n${JSON.stringify(optimizedData, null, 2)}`;
        }

        const currentDate = new Date();
        const currentDateString = currentDate.toDateString();
        const currentYear = currentDate.getFullYear();

        // Excel Date Conversion Logic (for the AI to understand)
        // Excel base date: Dec 30, 1899. 
        // Example: 45291 = ~Jan 2024
        // Formula: new Date(Math.round((excelDate - 25569) * 86400 * 1000))

        const systemPromptWithDate = `${systemPrompt}

CURRENT DATE: ${currentDateString} (Year: ${currentYear})

CRITICAL DATA FORMAT INSTRUCTION:
- Dates (Resource start/end, Signed Date) are stored as EXCEL SERIAL NUMBERS (e.g., 45291.4375).
- You MUST convert these to readable dates to answer questions.
- Approximate conversion:
  - 44562 = Jan 1, 2022
  - 44927 = Jan 1, 2023
  - 45292 = Jan 1, 2024
  - 45658 = Jan 1, 2025
  - 46023 = Jan 1, 2026

When user asks "ending this year (${currentYear})":
1. Look for 'Resource End Date' between approx ${Math.floor((new Date(currentYear, 0, 1) - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24))} and ${Math.floor((new Date(currentYear, 11, 31) - new Date(1899, 11, 30)) / (1000 * 60 * 60 * 24))}
2. Or simply convert the number to a date in your analysis.

PROFIT CALCULATION UPDATE:
- Revenue = 'Billing Rate' (if monthly) * 12 OR 'ARR Value'
- Cost = Minimum Billable Amount (based on Level)
- Profit = Revenue - Cost`;

        const messages = [
            { role: 'system', content: systemPromptWithDate },
            { role: 'user', content: `User Question: ${userQuery}\n\nEmployee Data:\n${dataContext}` }
        ];

        try {
            const result = await this.openAIClient.getChatCompletions(
                this.deployment,
                messages,
                {
                    maxTokens: 1000,
                    temperature: 0.3, // Lower temperature for more factual responses
                    topP: 0.9
                }
            );

            if (result.choices && result.choices.length > 0) {
                return result.choices[0].message.content;
            }

            return "I couldn't generate a response. Please try rephrasing your question.";
        } catch (error) {
            console.error('Azure OpenAI API Error:', error);
            throw error;
        }
    }
}

module.exports.IEBABot = IEBABot;

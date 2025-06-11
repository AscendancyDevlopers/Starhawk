require('dotenv').config();
const fs = require('fs');
const { google } = require("googleapis");
const credentials = JSON.parse(fs.readFileSync("service-account.json", "utf8"));
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });

/*
20% of the defence industry produces MPU, Military Production Units
100% of Government spending into the consortium goes into MPU

$1,284,040,000,000.00 Defence Industry
20bn Per MPU

Always Rounding Down

Each MPU Produces 100 

Each Additional MPU adds 0.05 Production Efficency to that line

Things that can be producted
- Supply?
- Ammunition?
- Assets
*/

// === Sheet Input Placeholders ===
let sheetProductionLines = []; // Fetched from Google Sheets
let sheetMPUAssignments = {}; // Fetched from Google Sheets { itemName: MPUs }

// === Sheet Output Placeholder ===
let monthlyProductionReport = [];

const STAFF_DATABASE = "1xbZDUz-k_DH929kd67F22ZMOWdAC1x5aa0IzcewoJuY";

// === Global Inputs ===
let Base_Defence_Industry = 1284040000000;
let Scaled_Defence_Industry = Math.floor(Base_Defence_Industry / 1000000000); // $1,284bn
let Government_Spending = 0; // Set from sheet externally
let Union_MPU_Total = 0;
const MPU_Output = 120; // Each MPU produces 100 units
const MPU_COST = 20; // In billions per MPU
const BASE_EFFICIENCY = 1.0;
const debugMode = true;

// === Load Production Items ===
async function loadProductionItems() {
    const sheetName = "Specialist Asset Register";
    const range = `${sheetName}!A2:N`; // A to N includes columns A to N (index 0 to 13)

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: STAFF_DATABASE,
        range,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.error("No data found in Specialist Asset Register.");
        return;
    }

    sheetProductionLines = rows
        .filter(row => row[0] && row[13]) // Require name and production cost
        .map(row => ({
            name: row[0],
            id: row[1] || "",
            version: row[2] || "",
            type: row[3] || "",
            use: row[4] || "",
            Production_Cost: parseFloat(row[13]) || 1, // Avoid div by 0
        }));
}


// === Helper Function ===
function calculateMPUs(defenceIndustry, governmentSpending) {
    let industryMPUs = Math.floor((defenceIndustry * 0.5) / MPU_COST);
    let govMPUs = Math.floor(governmentSpending / MPU_COST);
    return industryMPUs + govMPUs;
}

// === MPU Production Class ===
class MPU_Production_Item {
    constructor(name, type, id, version, use, productionCost, mpuDedicated) {
        this.name = name;
        this.id = id;
        this.version = version;
        this.type = type;
        this.use = use;
        this.productionCost = productionCost;
        this.mpuDedicated = mpuDedicated || 0;
        this.updateProduction();
    }

    updateProduction() {
        this.efficiency = BASE_EFFICIENCY + (this.mpuDedicated * 0.05);
        this.productionUnits = this.mpuDedicated * MPU_Output * this.efficiency;
        this.monthlyProduction = Math.floor(this.productionUnits / this.productionCost);
    }

    addMPU() {
        this.mpuDedicated += 1;
        return this.mpuDedicated;
    }

    setMPU(num) {
        this.mpuDedicated = num;
        return this.mpuDedicated;
    }

    removeMPU() {
        this.mpuDedicated -= 1;
        if (this.mpuDedicated <= 0)
            this.mpuDedicated = 0;
        return this.mpuDedicated;
    }
}

// === Monthly Update Function ===
function runMonthlyProductionUpdate() {
    Union_MPU_Total = calculateMPUs(Scaled_Defence_Industry, Government_Spending);
    console.log(`MPUs Available: ${Union_MPU_Total}`);

    monthlyProductionReport = [];

    for (let line of sheetProductionLines) {
        const assignedMPUs = sheetMPUAssignments[line.name] || 0;
        const item = new MPU_Production_Item(
            line.name, line.type, line.id, line.version, line.use, line.Production_Cost, assignedMPUs
        );
        monthlyProductionReport.push(item);
    }

    updateSheetOutput(monthlyProductionReport);
}

// === Sheet Update Stub ===
async function updateSheetOutput(report) {
    console.log("== Monthly Production Report ==");

    const sheetName = "Specialist Asset Register";
    const fullRange = `${sheetName}!F2:F`; // Column F (existing production)

    // Fetch current F column values to add to
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: STAFF_DATABASE,
        range: fullRange,
    });

    const existingValues = res.data.values || [];

    const updates = [];

    for (let item of report) {
        const rowIndex = sheetProductionLines.findIndex(r => r.id === item.id);
        if (rowIndex === -1) {
            console.warn(`⚠️ ID ${item.id} not found in sheet, skipping...`);
            continue;
        }

        const sheetRow = rowIndex + 2; // Offset for 1-based indexing + header
        const cellRef = `F${sheetRow}`;

        const prevValueRaw = existingValues[rowIndex]?.[0] ?? "0";
        const prevValue = parseFloat(prevValueRaw.replace(/,/g, "")) || 0;

        const newValue = prevValue + item.monthlyProduction;

        if (prevValue == newValue)
        {
            return 0;
        }
    

        if (debugMode) {
            console.log(`Would update: ${cellRef} = ${prevValue} + ${item.monthlyProduction} => ${newValue}`);
            console.log("\n");
        } else {
            updates.push({
                range: `${sheetName}!${cellRef}`,
                values: [[newValue]],
            });
        }

        console.log(`${item.name}: ${item.monthlyProduction} units (Efficiency: ${item.efficiency.toFixed(2)}, MPUs: ${item.mpuDedicated})`);
    }

    if (!debugMode && updates.length > 0) {
        const resource = {
            data: updates,
            valueInputOption: "USER_ENTERED",
        };

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: STAFF_DATABASE,
            resource,
        });

        console.log("✅ Sheet updated.\n");
    }
}

await loadProductionItems();


module.exports = 
{
    runMonthlyProductionUpdate,
    sheetProductionLines
};

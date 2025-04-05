const { google } = require("googleapis");
const fs = require("fs");
const csvParser = require("csv-parser");
const fastCsv = require("fast-csv");
require("dotenv").config();

const credentials = JSON.parse(fs.readFileSync("service-account.json", "utf8"));

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });
const CSV_DIR = "./csv_files";

if (!fs.existsSync(CSV_DIR)) fs.mkdirSync(CSV_DIR);

/**
 * Extracts a spreadsheet ID from a Google Sheets link.
 * @param {string} link - The Google Sheets URL or spreadsheet ID.
 * @returns {string|null} - The extracted spreadsheet ID.
 */
function extractSpreadsheetId(link) {
    const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : link; // If it's already an ID, return as is
}

/**
 * Downloads sheets from given spreadsheet IDs or links.
 * @param {string[] | string} sheetInputs - An array of spreadsheet IDs or links (or a single input).
 */
async function downloadSheets(sheetInputs, outputDir = CSV_DIR) {
    if (!Array.isArray(sheetInputs)) {
        sheetInputs = [sheetInputs]; // Convert single input to an array
    }
    for (let input of sheetInputs) {
        const sheetId = extractSpreadsheetId(input); // Extract ID from link if needed
        try {
            const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
            const sheetTitle = sheetInfo.data.properties.title.replace(/\s+/g, "_");
            for (const sheet of sheetInfo.data.sheets) {
                const sheetName = sheet.properties.title;
                const range = `${sheetName}`;
                const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
                const data = response.data.values || [];
                const csvFilePath = `${outputDir}/${sheetTitle}_${sheetName}.csv`;
                const ws = fs.createWriteStream(csvFilePath);
                fastCsv.write(data, { headers: true }).pipe(ws);
                console.log(`✅ Saved: ${csvFilePath}`);
            }
        } catch (error) {
            console.error(`❌ Error downloading sheet (${sheetId}):`, error);
        }
    }
}

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows))
            .on("error", reject);
    });
}

async function editCsv(filePath, rowName, colName, newValue) {
    const data = await readCsv(filePath);
    const headers = Object.keys(data[0]);
    const colIndex = headers.indexOf(colName);

    if (colIndex === -1) {
        console.error(`Column "${colName}" not found.`);
        return;
    }

    let found = false;
    for (let row of data) {
        if (row[headers[0]] === rowName) {
            row[colName] = newValue;
            found = true;
            break;
        }
    }

    if (!found) {
        console.error(`Row "${rowName}" not found.`);
        return;
    }

    return new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(filePath);
        fastCsv.write(data, { headers: true }).pipe(ws).on("finish", resolve).on("error", reject);
    });
}

async function uploadCsv(sheetId, sheetName, csvFilePath) {
    try {
        const data = await readCsv(csvFilePath);
        const values = [Object.keys(data[0])].concat(data.map(Object.values));

        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${sheetName}`,
            valueInputOption: "RAW",
            requestBody: { values },
        });

        console.log(`Uploaded ${csvFilePath} to ${sheetName} in ${sheetId}`);
    } catch (error) {
        console.error(`Error uploading ${csvFilePath}:`, error);
    }
}

async function testGoogleSheetsConnection() {
    try {
        if (!SPREADSHEET_IDS.length) {
            console.error("No spreadsheet IDs found in environment variables.");
            return;
        }

        const sheetId = SPREADSHEET_IDS[0];
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

        console.log(`Successfully connected to Google Sheets API.`);
        console.log(`Spreadsheet Title: ${sheetInfo.data.properties.title}`);
        console.log(`Sheets Available: ${sheetInfo.data.sheets.map(s => s.properties.title).join(", ")}`);
    } catch (error) {
        console.error("Error connecting to Google Sheets API:", error);
    }
}

async function readCell(filePath, rowNameOrCell, colName = null, headerRow = 2) {
    const data = await readCsv(filePath);
  
    // If colName is null, assume rowNameOrCell is a direct cell reference (e.g., "B2")
    if (!colName) {
      const match = rowNameOrCell.match(/^([A-Z]+)(\d+)$/);
      if (!match) {
        console.error("Invalid cell reference format.");
        return;
      }
  
      const [, colLetter, rowNumberStr] = match;
      const rowNumber = parseInt(rowNumberStr, 10);
      const colIndex = colLetter.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), -1);
  
      // Adjust row index: headerRow is the row where headers start,
      // so the data rows start at headerRow+1
      if (rowNumber <= headerRow || colIndex < 0) {
        console.error("Invalid cell reference.");
        return;
      }
  
      // row index in data array: subtract headerRow+1 (since data[0] corresponds to headerRow)
      const dataRowIndex = rowNumber - (headerRow + 1);
      if (dataRowIndex < 0 || dataRowIndex >= data.length) {
        console.error("Row out of range.");
        return;
      }
      
      const headers = Object.keys(data[0]);
      if (colIndex >= headers.length) {
        console.error("Column out of range.");
        return;
      }
      
      return data[dataRowIndex][headers[colIndex]];
    }
  
    // Otherwise, use row and column headers to locate the value.
    // The headers are assumed to be in data[0] from the headerRow.
    const headers = Object.keys(data[0]);
    const colIndex = headers.indexOf(colName);
    if (colIndex === -1) {
      console.error(`Column "${colName}" not found.`);
      return;
    }
  
    // Search rows starting from row index headerRow (i.e. data[0] is row headerRow)
    for (const row of data) {
      if (row[headers[0]] === rowNameOrCell) {
        return row[colName];
      }
    }
  
    console.error(`Row "${rowNameOrCell}" not found.`);
    return;
  }
  
module.exports = {readCsv, readCell, testGoogleSheetsConnection, downloadSheets, editCsv, uploadCsv };

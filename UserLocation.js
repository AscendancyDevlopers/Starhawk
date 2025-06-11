require('dotenv').config();
const fs = require('fs');
const { google } = require("googleapis");
const credentials = JSON.parse(fs.readFileSync("service-account.json", "utf8"));
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });

const { SecureLocations, PossibleLocations } = require('./Locations');

const Player_Databse = "1Mo5l3pa9IVmisVCzhiFofja5CB5KWqm9ucsxrx-3dSs";
const sheetName = "Player Database";

// Helper to get all rows
async function fetchSheetData() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: Player_Databse,
        range: `${sheetName}!A2:C`
    });
    return res.data.values || [];
}

// Get a user's location
async function getUserLocation(userId) {
    const rows = await fetchSheetData();
    const entry = rows.find(row => row[0] === String(userId));
    if (!entry) return null;

    const locationObj = PossibleLocations.find(loc => loc.name === entry[2]);
    return locationObj ? locationObj.name : entry[2];
}

// Set or update a user's location
async function setUserLocation(userId, username, newLocation) {
    const rows = await fetchSheetData();
    const index = rows.findIndex(row => row[0] === String(userId));
    const values = [String(userId), username, newLocation];

    if (index === -1) {
        // Add new row
        await sheets.spreadsheets.values.append({
            spreadsheetId: Player_Databse,
            range: `${sheetName}!A2:C`,
            valueInputOption: "RAW",
            requestBody: { values: [values] },
        });
    } else {
        // Update existing row
        const rowNumber = index + 2; // A2 = row 2
        await sheets.spreadsheets.values.update({
            spreadsheetId: Player_Databse,
            range: `${sheetName}!A${rowNumber}:C${rowNumber}`,
            valueInputOption: "RAW",
            requestBody: { values: [values] },
        });
    }
}

// Get all user locations
async function getAllUserLocations() {
    const rows = await fetchSheetData();
    return rows.map(row => ({
        userId: row[0],
        username: row[1],
        location: row[2],
    }));
}

// Set all new users to "Government Grounds"
async function startupUserLocations(userList) {
    const rows = await fetchSheetData();
    const existingIds = new Set(rows.map(row => row[0]));

    for (const user of userList) {
        if (!existingIds.has(String(user.id))) {
            await setUserLocation(user.id, user.username, "Government Grounds");
        }
    }
}


module.exports = {
    getUserLocation,
    setUserLocation,
    getAllUserLocations,
    startupUserLocations
};

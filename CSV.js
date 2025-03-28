/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
// saveToCSV.js
// Function to save to a .csv file
//
// Discord: 
/////////////////////////////////////////////////////////////////
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require('fs');
const csv = require("csv-parser");
const filePath = "csv_files/MP_Locations.csv";


function saveToCSV(users) {
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: "userId", title: "UserID" },
            { id: "username", title: "Username" },
            { id: "location", title: "Location" }
        ]
    });

    csvWriter.writeRecords(users)
        .then(() => console.log(`CSV file saved as ${filePath}`))
        .catch(err => console.error("Error writing CSV:", err));
}

async function readCSV() {
    return new Promise((resolve, reject) => {
        const users = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                users.push(row);
            })
            .on('end', () => {
                resolve(users);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

module.exports = {readCSV, saveToCSV};
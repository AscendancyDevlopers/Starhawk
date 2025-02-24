/*
Changes

Happyness and cost of living = pop changes
Productivity changes by happyness
Financial Malpractice changes by high income happyness
Poverty Rate incrases by inverse GDP change
Life Expectancy random
Homeownership Rate changes by cost of living
Crime Rate Per 1m Changes by low income happyness
Income Increases With GDP
*/

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const {readCell, testGoogleSheetsConnection, downloadSheets, editCsv, uploadCsv} = require('./googleSheetsHandler');

/**
 * Generates a random floating-point number between min and max.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} - A random number between min and max.
 */
function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;  // Ensures a decimal result
}

async function UpdateKeyMetrics()
{

};

async function updatePopulationData() {
    console.log("\n\nUpdate Population Data");
    const tbl = "./csv_files/Staff_Database_PopulationData.csv";

    const groups = [
        "Liberal", "Conservative", "Capitalist", "Socialist", "Youth",
        "Adult", "Seniors", "Religious", "Non Religious", "Low Income",
        "Medium Income", "High Income"
    ];

    let updatedData = [];

    // Define popularity change variables
    let LiberalTotalChangeInPopularity = 0.02;
    let ConservativeTotalChangeInPopularity = -0.01;
    let CapitalistTotalChangeInPopularity = 0.01;
    let SocialistTotalChangeInPopularity = -0.005;
    let YouthTotalChangeInPopularity = 0.03;
    let AdultTotalChangeInPopularity = 0.01;
    let SeniorsTotalChangeInPopularity = -0.02;
    let ReligiousTotalChangeInPopularity = -0.015;
    let NonReligiousTotalChangeInPopularity = 0.025;
    let LowIncomeTotalChangeInPopularity = -0.005;
    let MediumIncomeTotalChangeInPopularity = 0.01;
    let HighIncomeTotalChangeInPopularity = -0.02;

    // Map group names to their popularity change variables
    const popularityChanges = {
        "Liberal": LiberalTotalChangeInPopularity,
        "Conservative": ConservativeTotalChangeInPopularity,
        "Capitalist": CapitalistTotalChangeInPopularity,
        "Socialist": SocialistTotalChangeInPopularity,
        "Youth": YouthTotalChangeInPopularity,
        "Adult": AdultTotalChangeInPopularity,
        "Seniors": SeniorsTotalChangeInPopularity,
        "Religious": ReligiousTotalChangeInPopularity,
        "Non Religious": NonReligiousTotalChangeInPopularity,
        "Low Income": LowIncomeTotalChangeInPopularity,
        "Medium Income": MediumIncomeTotalChangeInPopularity,
        "High Income": HighIncomeTotalChangeInPopularity
    };

    try {
        for (const group of groups) {
            // Read current Trust in Government value
            let trustValue = await readCell(tbl, group, "Trust in Government");
            console.log(`Raw Trust in Government (${group}):`, trustValue);

            trustValue = parseFloat(trustValue.replace(/[^0-9.-]/g, '')); // Clean non-numeric characters

            if (isNaN(trustValue)) {
                console.warn(`Skipping ${group} - Invalid trust value.`);
                continue;
            }

            // Read current Size value
            let sizeValue = await readCell(tbl, group, "Size");
            console.log(`Raw Size (${group}):`, sizeValue);

            sizeValue = parseFloat(sizeValue.replace(/[^0-9.-]/g, ''));

            if (isNaN(sizeValue)) {
                console.warn(`Skipping ${group} - Invalid size value.`);
                continue;
            }

            // Apply changes to Trust in Government
            let updatedTrust = trustValue;
            updatedTrust += popularityChanges[group]; // Apply predefined popularity change
            updatedTrust += getRandomNumber(-0.01, 0.01) * trustValue; // ±1% random change

            // Buff if below 50%, nerf if above 50%
            if (updatedTrust < 50) {
                updatedTrust += getRandomNumber(0, 1); // +0% to +1%
            } else {
                updatedTrust -= getRandomNumber(0, 1); // -0% to -1%
            }

            // Clamp Trust in Government between 0 and 100
            updatedTrust = Math.max(0, Math.min(100, updatedTrust));

            // Apply changes to Size with ±1% random change
            let updatedSize = sizeValue + getRandomNumber(-0.01, 0.01) * sizeValue;

            console.log(`Updated Trust in Government (${group}): ${updatedTrust.toFixed(2)}`);
            console.log(`Updated Size (${group}): ${updatedSize.toFixed(2)}`);

            // Store updated values for CSV writing
            updatedData.push({ group, column: "Trust in Government", value: updatedTrust.toFixed(2) });
            updatedData.push({ group, column: "Size", value: updatedSize.toFixed(2) });
        }

        // Write updated data back to the CSV
        for (const data of updatedData) {
            await editCsv(tbl, data.group, data.column, data.value);
        }

        console.log("Population data updated successfully!");

    } catch (error) {
        console.error("Error updating population data:", error);
    }
}

async function updateEconomicSectors() {
    console.log("\n\nUpdate Economic Sector Data");
    const tbl = "./csv_files/Staff_Database_EconomicSectorData.csv";
    
    const sectors = [
        "Office", "Construction", "Healthcare", "Manufacturing", "Real Estate",
        "Finance", "Retail", "Agriculture", "Forestry", "Defence",
        "Fishing", "Information", "Transport", "Electricity", "Water",
        "Mining", "Education", "Other", "Public Service", "Illicit", "Foreign Trade"
    ];

    const EconomicGrowth = 0.025;  // +2.5%
    const ConsumerSpendingChange = 0.01;  // Example: +1.0% (modify as needed)
    let updatedData = [];

    try {
        for (const sector of sectors) {
            let sectorValue = await readCell(tbl, sector, "Total Size ($)");
            console.log(`Raw ${sector}:`, sectorValue);

            // Remove currency symbols and non-numeric characters
            sectorValue = parseFloat(sectorValue.replace(/[^0-9.]/g, ''));

            if (isNaN(sectorValue)) {
                console.warn(`Skipping ${sector} - Invalid number.`);
                continue;
            }

            console.log(`Parsed ${sector}:`, sectorValue);

            // Apply changes
            let updatedValue = sectorValue;

            // Add Economic Growth (+2.5%)
            updatedValue += sectorValue * EconomicGrowth;

            // Add Consumer Spending Change (+1.0%)
            updatedValue += sectorValue * ConsumerSpendingChange;

            // Add a random change between -1.25% and +1.25%
            const randomChange = getRandomNumber(-0.0125, 0.0125) * sectorValue;
            updatedValue += randomChange;

            console.log(`Updated ${sector}: ${updatedValue.toFixed(2)}`);

            // Store updated value for CSV writing
            updatedData.push({ sector, value: updatedValue.toFixed(2) });
        }

        // Write updated data back to the CSV
        for (const data of updatedData) {
            await editCsv(tbl, data.sector, "Base Size", data.value);
        }

        console.log("Economic sectors updated successfully!");

    } catch (error) {
        console.error("Error updating economic sectors:", error);
    }
}

async function RunEndofMonth()
{

};

module.exports = {updatePopulationData, updateEconomicSectors };
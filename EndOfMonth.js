/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
//
// Discord: 
/////////////////////////////////////////////////////////////////

let EconomicGrowth = 0.025;
let ConsumerSpendingChange = 0.01;
let PopulationHappiness = 0.00;

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const {readCell, downloadSheets, editCsv, uploadCsv} = require('./googleSheetsHandler');

/**
 * Generates a random floating-point number between min and max.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} - A random number between min and max.
 */
function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Gets the base metrics for the updates
 */
async function GetBaseMetrics() {

}

/**
 * Updates key economic metrics.
 */
async function UpdateKeyMetrics() {
    console.log("\n\nUpdating Key Metrics");
    const filePath = "./csv_files/Staff_Database_MetricsData.csv";
    const metrics = [
        "Population Happiness", "Inflation", "GDP", "Interest Rate", "Average Income", "Unemployment",
        "Productivity", "Financial Malpractice", "Poverty Rate", "Life Expectancy",
        "Population", "Pop Growth Rate", "Homeownership Rate", "Crime Rate Per 1m", "Primary Education",
        "Secondary Education", "Tertiary Education", "Consumer Spending", "Big Mac Index"
    ];
    
    let updatedData = [];
    
    // Fetch all required base values first
    let metricValues = {};
    try {
        for (const metric of metrics) {
            let value = await readCell(filePath, metric, "Value");
            value = parseFloat(value.replace(/[^0-9.-]/g, ''));
            if (isNaN(value)) {
                console.warn(`Skipping ${metric} - Invalid number.`);
                continue;
            }
            metricValues[metric] = value;
        }

        // Define important variables before calculations
        let GDP = metricValues["GDP"] || 1000;
        let oldGDP = metricValues["GDP"] || 1000;
        let Inflation = metricValues["Inflation"] || 2;
        let Unemployment = metricValues["Unemployment"] || 5;
        let PovertyRate = metricValues["Poverty Rate"] || 10;
        let inflationRate = metricValues["Inflation"];
        let updatedPopulation = metricValues["Population"];
        let previousPopulation = metricValues["Population"];
        let oldPopulationHappiness = metricValues["Population Happiness"];
        let GDPGrowth = 0.00;

        for (const metric of metrics) {
            let value = metricValues[metric] || 0;
            let updatedValue = value;

            switch (metric) {
                case "Population Happiness":
                    console.log(`Previous Happiness: ${oldPopulationHappiness}, Updated Happiness: ${PopulationHappiness}`);
                    value = oldPopulationHappiness;
                    updatedValue = PopulationHappiness;
                    break;

                case "Inflation":
                    updatedValue = (value * getRandomNumber(0.95, 1.05));
                    break;

                case "Big Mac Index":
                    updatedValue = value * (1 + inflationRate / 100);
                    break;

                case "GDP":
                    updatedValue = value * (1 + EconomicGrowth + getRandomNumber(-0.02, 0.03));
                    GDP = updatedValue;
                    GDPGrowth = GDP / oldGDP - 1;
                    break;

                case "Consumer Spending":
                    updatedValue = value * (1 + ConsumerSpendingChange + getRandomNumber(-0.02, 0.03));
                    break;

                case "Unemployment":
                    updatedValue = value * (1 + (-EconomicGrowth * 0.3 + Inflation * 0.2) * getRandomNumber(0.9, 1.1));
                    break;

                case "Productivity":
                    updatedValue = value * (1 + ((PopulationHappiness - 50) * 0.0001) + getRandomNumber(-0.02, 0.02));
                    break;
                    

                case "Financial Malpractice":
                    updatedValue = value * (1 + ((Inflation * 0.2 - GDPGrowth * 0.1) * getRandomNumber(0.95, 1.05)));

                    break;

                case "Poverty Rate":
                    updatedValue = value * (1 + (1 - (value / 100)) * getRandomNumber(-0.02, 0.02));
                    break;

                case "Life Expectancy":
                    let happinessFactor = PopulationHappiness / 100;
                    let inflationImpact = 1 - (Inflation / 50);
                    let expectancyChange = (happinessFactor * 2 - 1) * 1.5 * inflationImpact;
                    expectancyChange = Math.max(-1.5, Math.min(expectancyChange, 1.5));
                    updatedValue = value + expectancyChange;
                    break;

                case "Homeownership Rate":
                    let happinessImpact = PopulationHappiness > 60 ? 0.5 : -0.5;
                    let inflationEffect = Inflation > 3 ? -0.75 : 0.25;
                    let homeChange = happinessImpact + inflationEffect;
                    homeChange = Math.max(-1, Math.min(homeChange, 1));
                    updatedValue = value + homeChange;
                    break;

                case "Crime Rate Per 1m":
                    updatedValue = value * (1 + ((Unemployment * 0.005) + (PovertyRate * 0.003)) * getRandomNumber(0.95, 1.05));
                    break;

                case "Population":
                    updatedPopulation = Math.round(value * getRandomNumber(
                        PopulationHappiness > 50 ? 1.005 : 0.995,
                        PopulationHappiness > 50 ? 1.025 : 1.005
                    ));
                    updatedValue = updatedPopulation;
                    break;

                case "Pop Growth Rate":
                    updatedValue = ((updatedPopulation - previousPopulation) / previousPopulation) * 100;
                    break;
                    
                case "Primary Education":
                case "Secondary Education":
                case "Tertiary Education":
                    updatedValue = value * (1 + getRandomNumber(-0.02, 0.02));
                    break;
            }

            let percentageChange = ((updatedValue - value) / value) * 100;

            console.log(`${metric} Change: ${formatPercentage(percentageChange)}\x1b[0m`);

            updatedData.push({ metric, updatedValue: updatedValue.toFixed(2) });
        }

        // Write back the updated values to the CSV
        for (const data of updatedData) {
            await editCsv(filePath, data.metric, "Value", data.updatedValue);
        }

        console.log("Key Metrics updated successfully!");
    } catch (error) {
        console.error("Error updating key metrics:", error);
    }
}

/**
 * Updates key population metrics.
 */
async function updatePopulationData() {
    console.log("\n\nUpdate Population Data");
    const tbl = "./csv_files/Staff_Database_PopulationData.csv";

    const groupPairs = [
        ["Capitalist", "Socialist"],
        ["Liberal", "Conservative"],
        ["Religious", "Non Religious"],
        ["Youth", "Adult"],
        ["Low Income", "Medium Income", "High Income"]
    ];

    const trustChangeTable = {
        "Capitalist": -0.0005,
        "Socialist": 0.0005,
        "Liberal": 0.0003,
        "Conservative": -0.0003,
        "Religious": -0.0004,
        "Non Religious": 0.0004,
        "Youth": 0.0006,
        "Adult": -0.0006,
        "Low Income": -0.0007,
        "Medium Income": 0.0002,
        "High Income": 0.0005
    };

    let totalWeightedTrust = 0;
    let totalSize = 0;
    let updatedData = [];

    try {
        for (const groupPair of groupPairs) {
            let values = await Promise.all(groupPair.map(async (group) => {
                let trust = parseFloat((await readCell(tbl, group, "Trust in Government")).replace(/[^0-9.-]/g, ''));
                let size = parseFloat((await readCell(tbl, group, "Size")).replace(/[^0-9.-]/g, ''));
                return { group, trust, size };
            }));

            for (let i = 0; i < values.length; i++) {
                let group = values[i];

                // Independent Trust Update
                let oldTrust = group.trust;
                let trustChange = trustChangeTable[group.group] || 0;
                group.trust = Math.max(0, Math.min(1, group.trust + trustChange));

                // **Weighted trust calculation**
                totalWeightedTrust += group.trust * group.size;
                totalSize += group.size;

                updatedData.push({ group: group.group, column: "Trust in Government", value: group.trust.toFixed(4) });
                updatedData.push({ group: group.group, column: "Size", value: group.size.toFixed(4) });
            }
        }

        // Normalize Income Groups to sum to 1.0
        let incomeGroups = updatedData.filter(d => ["Low Income", "Medium Income", "High Income"].includes(d.group));
        let totalIncomeSize = incomeGroups.reduce((sum, d) => sum + parseFloat(d.value), 0);
        if (totalIncomeSize > 0) {
            incomeGroups.forEach(d => d.value = ((parseFloat(d.value) / totalIncomeSize)).toFixed(4));
        }

        // **Update Population Happiness using weighted average**
        PopulationHappiness = totalSize > 0 ? totalWeightedTrust / totalSize : 0.5;
        PopulationHappiness = Math.max(0.4, Math.min(0.6, PopulationHappiness)); // Ensure within 0.4-0.6 range

        console.log(`\n📊 Population Happiness: ${(PopulationHappiness * 100).toFixed(2)}%`);

        for (const data of updatedData) {
            await editCsv(tbl, data.group, data.column, data.value);
        }
        console.log("Population data updated successfully!");
    } catch (error) {
        console.error("Error updating population data:", error);
    }
}

/**
 * Updates economic sector metrics.
 */
async function updateEconomicSectors() {
    console.log("\n\nUpdate Economic Sector Data");
    const tbl = "./csv_files/Staff_Database_EconomicSectorData.csv";

    const sectors = [
        "Office", "Construction", "Healthcare", "Manufacturing", "Real Estate",
        "Finance", "Retail", "Agriculture", "Forestry", "Defence",
        "Fishing", "Information", "Transport", "Electricity", "Water",
        "Mining", "Education", "Other", "Public Service", "Illicit", "Foreign Trade"
    ];

    let updatedData = [];

    try {
        for (const sector of sectors) {
            let sectorValue = parseFloat((await readCell(tbl, sector, "Total Size ($)")).replace(/[^0-9.]/g, ''));
            if (isNaN(sectorValue)) {
                console.warn(`Skipping ${sector} - Invalid number.`);
                continue;
            }

            let updatedValue = sectorValue + sectorValue * (EconomicGrowth + ConsumerSpendingChange);
            updatedValue += getRandomNumber(-0.0125, 0.0125) * sectorValue;

            // Calculate % change
            let percentageChange = ((updatedValue - sectorValue) / sectorValue) * 100;

            // Log with color coding
            console.log(`Sector (${sector}): ${formatPercentage(percentageChange)}`);

            updatedData.push({ sector, value: updatedValue.toFixed(2) });
        }

        for (const data of updatedData) {
            await editCsv(tbl, data.sector, "Base Size", data.value);
        }
        console.log("Economic sectors updated successfully!");

    } catch (error) {
        console.error("Error updating economic sectors:", error);
    }
}

/**
 * Formats a percentage change with color coding.
 * Green: Increase, Red: Decrease, Purple: ±25% or more.
 */
function formatPercentage(change) {
    const color = Math.abs(change) >= 25 ? '\x1b[35m' : change > 0 ? '\x1b[32m' : '\x1b[31m';
    return `${color}${change.toFixed(2)}%\x1b[0m`;
}


async function RunEndofMonth()
{
    await updatePopulationData()
    await updateEconomicSectors()
    await UpdateKeyMetrics()
};

module.exports = {RunEndofMonth};
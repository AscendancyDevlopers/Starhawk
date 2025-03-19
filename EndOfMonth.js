require('dotenv').config();
const { readCell, editCsv } = require('./googleSheetsHandler');

// ─── HELPER FUNCTIONS ─────────────────────────────
function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function formatPercentage(change) {
  let color;
  if (Math.abs(change) < 0.001) {
    color = '\x1b[33m';
    change = 0.00;
  } else if (Math.abs(change) >= 25) {
    color = '\x1b[35m';
  } else {
    color = change > 0 ? '\x1b[32m' : '\x1b[31m';
  }
  return `${color}${change.toFixed(3)}%\x1b[0m`;
}

// ─── GLOBAL VARIABLES ─────────────────────────────
// Tax rates (to be loaded from CSV)
const TaxRates = {
  "Income Low": 0.0,
  "Income Medium": 0.0,
  "Income High": 0.0,
  "Local Government Levy": 0.0,
  "GST": 0.0,
  "Savings Tax": 0.0,
  "Office": 0.0,
  "Construction": 0.0,
  "Healthcare": 0.0,
  "Manufacturing": 0.0,
  "Real Estate": 0.0,
  "Finance": 0.0,
  "Retail": 0.0,
  "Agriculture": 0.0,
  "Forestry": 0.0,
  "Fishing": 0.0,
  "Defence": 0.0,
  "Information": 0.0,
  "Transport": 0.0,
  "Electricity": 0.0,
  "Water": 0.0,
  "Mining": 0.0,
  "Education": 0.0
};

// Global economic variables (set to zero to avoid NaN)
global.EconomicGrowth = 0.00;
global.InflationRate = 0.00;
global.UnemploymentRate = 0.00;
global.ConsumerSpendingChange = 0.0;
global.PovertyRateChange = 0.0;
global.PrimaryEducationChange = 0.0;
global.SecondaryEducationChange = 0.0;
global.ProductivityChange = 0.02;
global.FinancialMalpracticeChange = 0.0;
global.HomeownershipRateChange = 0.0;
global.CrimeRateChange = 0.0;
global.PopulationChange = 0.0;
global.TertiaryEducationChange = 0.0;

let PopulationHappiness = 0.5; // default

// ─── FILE PATHS & LISTS ─────────────────────────────
const taxFilePath = "./csv_files/Draft_Budget_Taxes.csv";
const popFilePath = "./csv_files/Staff_Database_PopulationData.csv";
const econFilePath = "./csv_files/Staff_Database_EconomicSectorData.csv";
const totalsFilePath = "./csv_files/Draft_Budget_Totals.csv";
const metricsFilePath = "./csv_files/Staff_Database_MetricsData.csv";
const taxesDataFilePath = "./csv_files/Staff_Database_TaxesData.csv";

// Population CSV is assumed to have columns:
// Voter Groups, Size, Trust in Government, Avg Income, Min Income, Max Income
const populationGroups = [
  "Capitalist", "Socialist",
  "Liberal", "Conservative",
  "Religious", "Non Religious",
  "Youth", "Adult", "Seniors",
  "Low Income", "Medium Income", "High Income"
];

const sectorsList = [
  "Office", "Construction", "Healthcare", "Manufacturing", "Real Estate",
  "Finance", "Retail", "Agriculture", "Forestry", "Defence",
  "Fishing", "Information", "Transport", "Electricity", "Water",
  "Mining", "Education", "Other", "Public Service", "Illicit", "Foreign Trade"
];

const keyMetricsList = [
  "Population Happiness", "Inflation", "GDP", "Interest Rate", "Average Income", "Unemployment",
  "Productivity", "Financial Malpractice", "Poverty Rate", "Life Expectancy",
  "Population", "Pop Growth Rate", "Homeownership Rate", "Crime Rate", "Primary Education",
  "Secondary Education", "Tertiary Education", "Consumer Spending", "Big Mac Index"
];

// Define population group sets that share size
const popGroupSets = {
  "Political": ["Liberal", "Conservative"],
  "Economic": ["Capitalist", "Socialist"],
  "Age": ["Youth", "Adult", "Seniors"],
  "Religious": ["Religious", "Non Religious"],
  "Income": ["Low Income", "Medium Income", "High Income"]
};

// ─── MAIN FUNCTION ─────────────────────────────
async function RunEndofMonth() {
  console.log("Starting End-of-Month Process");

  // ─── LOAD TAX EFFECTS FROM TAXES DATA CSV ─────────
  let taxEffects = {};
  for (const tax in TaxRates) {
    let effect1Str = await readCell(taxesDataFilePath, tax, "Effect on Pop");
    let effect2Str = await readCell(taxesDataFilePath, tax, "Effect on Pop 2");
    taxEffects[tax] = {
      effect1: parseFloat(effect1Str.replace(/[^0-9.]/g, '')) || 0,
      effect2: parseFloat(effect2Str.replace(/[^0-9.]/g, '')) || 0
    };
  }

  // ─── LOAD ALL DATA ─────────────────────────
  // 1. Load Tax Rates (from Draft_Budget_Taxes.csv)
  for (const tax in TaxRates) {
    let rawValue = await readCell(taxFilePath, tax, "Rate");
    let value = parseFloat(rawValue.replace('%', '')) / 100;
    let previousValue = TaxRates[tax];
    TaxRates[tax] = isNaN(value) ? 0.0 : value;
    let percentageChange = ((TaxRates[tax] - previousValue) / (previousValue || 1)) * 100;
    console.log(`Name: ${tax}`);
    console.log(`Old Value: ${previousValue.toFixed(3)}`);
    console.log(`New Value: ${TaxRates[tax].toFixed(3)}`);
    console.log(`% change: ${formatPercentage(percentageChange)}`);
  }

  // 2. Load Population Data (including Avg Income for income groups)
  let popData = [];
  for (const group of populationGroups) {
    let trustStr = await readCell(popFilePath, group, "Trust in Government");
    let sizeStr = await readCell(popFilePath, group, "Size");
    let avgIncome = null;
    if (["Low Income", "Medium Income", "High Income"].includes(group)) {
      let incomeStr = await readCell(popFilePath, group, "Avg Income");
      avgIncome = parseFloat(incomeStr.replace(/[^0-9.]/g, '')) || 0;
    }
    let trust = parseFloat(trustStr.replace(/[^0-9.-]/g, '')) || 0;
    let size = parseFloat(sizeStr.replace(/[^0-9.-]/g, '')) || 0;
    popData.push({ group, trust, size, avgIncome });
  }

  // 3. Load Economic Sector Data
  let sectorData = {};
  for (const sector of sectorsList) {
    let baseSizeStr = await readCell(econFilePath, sector, "Base Size");
    let oneTimeStr = await readCell(econFilePath, sector, "One Time");
    let govSpendingStr = await readCell(econFilePath, sector, "Government Spending/Subsidies");
    let csEffectStr = await readCell(econFilePath, sector, "Consumer Spending Effect");
    let baseSize = parseFloat(baseSizeStr.replace(/[^0-9.]/g, '')) || 0;
    let oneTime = parseFloat(oneTimeStr.replace(/[^0-9.]/g, '')) || 0;
    let govSpending = parseFloat(govSpendingStr.replace(/[^0-9.]/g, '')) || 0;
    let csEffect = parseFloat(csEffectStr.replace(/[^0-9.-]/g, '')) || 0;
    sectorData[sector] = { baseSize, oneTime, govSpending, csEffect };
  }

  // 4. Load Administrative Spending for Public Service
  let adminStr = await readCell(totalsFilePath, "Administrive", "Sum");
  let adminNum = parseFloat(adminStr.replace("$Bn", "").replace(/,/g, "").trim()) || 0;
  adminNum = adminNum * 1000000;

  // 5. Load Key Metrics Data
  let metricsData = {};
  for (const metric of keyMetricsList) {
    let cellValue = await readCell(metricsFilePath, metric, "Value");
    let value = parseFloat(cellValue.replace(/[^0-9.-]/g, ''));
    metricsData[metric] = isNaN(value) ? 0 : value;
  }

  // ─── CALCULATIONS ─────────────────────────
  // Update global variables using dynamic tax effects
  global.ConsumerSpendingChange = 0.10
    - TaxRates["Income Low"] * taxEffects["Income Low"].effect1
    - TaxRates["Income Medium"] * taxEffects["Income Medium"].effect1
    - TaxRates["Income High"] * taxEffects["Income High"].effect1
    - TaxRates["GST"] * taxEffects["GST"].effect1
    + TaxRates["Savings Tax"] * taxEffects["Savings Tax"].effect1;

  global.PovertyRateChange =
      TaxRates["Income Low"] * taxEffects["Income Low"].effect2 +
      TaxRates["Income Medium"] * taxEffects["Income Medium"].effect2 +
      TaxRates["Income High"] * taxEffects["Income High"].effect2 +
      TaxRates["Savings Tax"] * taxEffects["Savings Tax"].effect2;

  global.EconomicGrowth = 0.01
    - TaxRates["Local Government Levy"] * taxEffects["Local Government Levy"].effect1
    - TaxRates["Office"] * taxEffects["Office"].effect1
    - TaxRates["Construction"] * taxEffects["Construction"].effect1
    - TaxRates["Healthcare"] * taxEffects["Healthcare"].effect1
    - TaxRates["Manufacturing"] * taxEffects["Manufacturing"].effect1
    - TaxRates["Real Estate"] * taxEffects["Real Estate"].effect1
    - TaxRates["Finance"] * taxEffects["Finance"].effect1
    - TaxRates["Retail"] * taxEffects["Retail"].effect1
    - TaxRates["Agriculture"] * taxEffects["Agriculture"].effect1
    - TaxRates["Forestry"] * taxEffects["Forestry"].effect1
    - TaxRates["Fishing"] * taxEffects["Fishing"].effect1
    - TaxRates["Defence"] * taxEffects["Defence"].effect1
    - TaxRates["Information"] * taxEffects["Information"].effect1
    - TaxRates["Transport"] * taxEffects["Transport"].effect1
    - TaxRates["Electricity"] * taxEffects["Electricity"].effect1
    - TaxRates["Water"] * taxEffects["Water"].effect1
    - TaxRates["Mining"] * taxEffects["Mining"].effect1
    - TaxRates["Education"] * taxEffects["Education"].effect1;

  global.InflationRate = TaxRates["GST"] * taxEffects["GST"].effect2;

  global.UnemploymentRate =
      TaxRates["Office"] * taxEffects["Office"].effect2 +
      TaxRates["Construction"] * taxEffects["Construction"].effect2 +
      TaxRates["Healthcare"] * taxEffects["Healthcare"].effect2 +
      TaxRates["Manufacturing"] * taxEffects["Manufacturing"].effect2 +
      TaxRates["Real Estate"] * taxEffects["Real Estate"].effect2 +
      TaxRates["Finance"] * taxEffects["Finance"].effect2 +
      TaxRates["Retail"] * taxEffects["Retail"].effect2 +
      TaxRates["Agriculture"] * taxEffects["Agriculture"].effect2 +
      TaxRates["Forestry"] * taxEffects["Forestry"].effect2 +
      TaxRates["Fishing"] * taxEffects["Fishing"].effect2 +
      TaxRates["Defence"] * taxEffects["Defence"].effect2 +
      TaxRates["Information"] * taxEffects["Information"].effect2 +
      TaxRates["Transport"] * taxEffects["Transport"].effect2 +
      TaxRates["Electricity"] * taxEffects["Electricity"].effect2 +
      TaxRates["Water"] * taxEffects["Water"].effect2 +
      TaxRates["Mining"] * taxEffects["Mining"].effect2 +
      TaxRates["Education"] * taxEffects["Education"].effect2;

  // Recalculate Population Happiness from loaded population data
  let totalTrust = 0, totalPop = 0;
  for (const pd of popData) {
    totalTrust += pd.trust * pd.size;
    totalPop += pd.size;
  }
  PopulationHappiness = totalPop > 0 ? totalTrust / totalPop : 0.5;
  PopulationHappiness = Math.max(0.4, Math.min(0.6, PopulationHappiness));

  // Log original Population Data
  for (const pd of popData) {
    console.log(`Name: ${pd.group}`);
    console.log(`Old Trust: ${pd.trust.toFixed(3)}`);
    console.log(`Old Size: ${pd.size.toFixed(3)}`);
  }

  // ─── PROCESS ECONOMIC SECTOR DATA ─────────
  let computedSectors = {};
  for (const sector of sectorsList) {
    if (sector === "Illicit") continue;
    let { baseSize, oneTime, govSpending, csEffect } = sectorData[sector];
    let intermediateValue = (baseSize + (oneTime * 0.25) + (govSpending * 0.60)) * (1 + global.EconomicGrowth);
    let finalValue = intermediateValue * (1 + (global.ConsumerSpendingChange * csEffect));
    finalValue = finalValue * (1 + getRandomNumber(-0.015, 0.015));
    if (sector === "Public Service") {
      finalValue = adminNum * (1 + getRandomNumber(-0.045, -0.035));
    }
    computedSectors[sector] = finalValue;
    let percentageChange = ((finalValue - baseSize) / (baseSize || 1)) * 100;
    console.log(`\nName: Sector (${sector})`);
    console.log(`Old Value: ${baseSize.toFixed(3)}`);
    console.log(`Intermediate Value: ${intermediateValue.toFixed(3)}`);
    console.log(`Consumer Spending Effect: ${csEffect.toFixed(3)}`);
    console.log(`Final Size: ${finalValue.toFixed(3)}`);
    console.log(`% change: ${formatPercentage(percentageChange)}`);
  }

  // Process "Illicit" sector: set equal to preliminary GDP × Crime Rate
  let preliminaryGDP = 0;
  for (const s in computedSectors) {
    preliminaryGDP += computedSectors[s];
  }
  let crimeRate = metricsData["Crime Rate"] || 0;
  let illicitValue = preliminaryGDP * crimeRate;
  computedSectors["Illicit"] = illicitValue;
  let illicitOldStr = await readCell(econFilePath, "Illicit", "Base Size");
  let illicitOld = parseFloat(illicitOldStr.replace(/[^0-9.]/g, '')) || 0;
  let illicitPercentageChange = ((illicitValue - illicitOld) / (illicitOld || 1)) * 100;
  console.log(`\nName: Sector (Illicit)`);
  console.log(`Old Value: ${illicitOld.toFixed(3)}`);
  console.log(`New Value: ${illicitValue.toFixed(3)}`);
  console.log(`% change: ${formatPercentage(illicitPercentageChange)}`);

  // Compute final GDP as sum of all sectors
  let finalGDP = 0;
  for (const s of sectorsList) {
    if (computedSectors[s] !== undefined) {
      finalGDP += computedSectors[s];
    }
  }
  // Compute computedGDPGrowth from key metric "GDP"
  let oldGDPMetric = metricsData["GDP"] || 1000;
  let computedGDPGrowth = finalGDP / oldGDPMetric - 1;
  console.log(`\nComputed GDP Growth: ${(computedGDPGrowth * 100).toFixed(3)}%`);

  // ─── POPULATION GROUP ADJUSTMENTS ─────────
  // For each set, randomize each group's size by ±2% then renormalize within the set.
  for (const setName in popGroupSets) {
    const groups = popGroupSets[setName];
    let originalTotal = groups.reduce((sum, g) => {
      let popItem = popData.find(p => p.group === g);
      return popItem ? sum + popItem.size : sum;
    }, 0);
    let randomized = {};
    let sumRandom = 0;
    for (const g of groups) {
      let popItem = popData.find(p => p.group === g);
      if (popItem) {
        let randSize = popItem.size * (1 + getRandomNumber(-0.02, 0.02));
        randomized[g] = randSize;
        sumRandom += randSize;
      }
    }
    for (const g of groups) {
      let popItem = popData.find(p => p.group === g);
      if (popItem) {
        popItem.newSize = randomized[g] * (originalTotal / sumRandom);
      }
    }
  }
  // For any group not in a set, simply randomize its size by ±2%
  for (const pd of popData) {
    let inSet = false;
    for (const setName in popGroupSets) {
      if (popGroupSets[setName].includes(pd.group)) {
        inSet = true;
        break;
      }
    }
    if (!inSet) {
      pd.newSize = pd.size * (1 + getRandomNumber(-0.02, 0.02));
    }
  }
  // Normalize overall sizes to sum to 1
  let totalNewSizeAll = popData.reduce((sum, p) => sum + p.newSize, 0);
  for (const pd of popData) {
    pd.normSize = pd.newSize / totalNewSizeAll;
  }
  // Update trust for each group: base trust is increased by 1.5% plus a random ±4%
  for (const pd of popData) {
    pd.newTrust = pd.trust * (1 + 0.015 + getRandomNumber(-0.04, 0.04));
  }
  // For income groups, update Avg Income by adding computedGDPGrowth and a random factor from –3% to 0%
  for (const pd of popData) {
    if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
      pd.newAvgIncome = pd.avgIncome * (1 + computedGDPGrowth + getRandomNumber(-0.02, 0.03));
    }
  }
  // Compute weighted average income for income groups
  let totalIncome = 0, totalIncomeWeight = 0;
  for (const pd of popData) {
    if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
      totalIncome += pd.newAvgIncome * pd.normSize;
      totalIncomeWeight += pd.normSize;
    }
  }
  let weightedAvgIncome = totalIncomeWeight > 0 ? totalIncome / totalIncomeWeight : 0;
  
  // Log population adjustments
  for (const pd of popData) {
    console.log(`\nName: ${pd.group}`);
    console.log(`Old Trust: ${pd.trust.toFixed(3)}`);
    console.log(`New Trust: ${pd.newTrust.toFixed(3)}`);
    console.log(`Old Size: ${pd.size.toFixed(3)}`);
    console.log(`New Normalized Size: ${pd.normSize.toFixed(3)}`);
    if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
      console.log(`Old Avg Income: ${pd.avgIncome.toFixed(3)}`);
      console.log(`New Avg Income: ${pd.newAvgIncome.toFixed(3)}`);
    }
  }

  console.log(`\nWeighted Average Income for Income Groups: ${weightedAvgIncome.toFixed(3)}`);

  let totalNewTrust = 0.0;
  for (const pd of popData) {
    totalNewTrust += pd.newTrust * pd.normSize;
  }
  PopulationHappiness = totalNewTrust;

  // ─── UPDATE KEY METRICS ─────────
  let Inflation = metricsData["Inflation"] || 2;
  let Unemployment = metricsData["Unemployment"] || 5;
  let PovertyRate = metricsData["Poverty Rate"] || 10;
  let previousPopulation = metricsData["Population"] || 0;
  let updatedPopulation = previousPopulation;
  let updatedKeyMetrics = {};
  let BaseChange = 0.01;

  for (const metric of keyMetricsList) {
    let value = metricsData[metric] || 0;
    let updatedValue = value;
    switch (metric) {
      case "Population Happiness":
        updatedValue = PopulationHappiness;
        break;
      case "Inflation":
        updatedValue = value * (1 + BaseChange + global.InflationRate + getRandomNumber(-0.02, 0.03));
        break;
      case "Big Mac Index":
        updatedValue = value * (1 + Inflation);
        break;
      case "GDP":
        updatedValue = finalGDP;
        updatedKeyMetrics["GDP"] = finalGDP;
        break;
      case "Consumer Spending":
        updatedValue = value * (1 + BaseChange + global.ConsumerSpendingChange + computedGDPGrowth + getRandomNumber(-0.02, 0.03));
        break;
      case "Unemployment":
        updatedValue = value * (1 + BaseChange + global.UnemploymentRate + -computedGDPGrowth + getRandomNumber(-0.03, 0.02));
        break;
      case "Productivity":
        updatedValue = value * (1 + BaseChange + global.ProductivityChange + (PopulationHappiness - 0.5) * 0.1 + getRandomNumber(-0.02, 0.03));
        break;
      case "Financial Malpractice":
        updatedValue = value * (1 + BaseChange + global.FinancialMalpracticeChange + ((Inflation - computedGDPGrowth / 2) + getRandomNumber(-0.02, 0.03)));
        break;
      case "Poverty Rate":
        updatedValue = value * (1 + BaseChange + global.PovertyRateChange + getRandomNumber(-0.02, 0.03));
        break;
      case "Life Expectancy": {
          let happinessFactor = (PopulationHappiness - 0.5) * 0.1;
          let inflationEffect = (-Inflation + 0.04) * 0.1;
          let expectancyChange = 1 + BaseChange + happinessFactor + inflationEffect + (getRandomNumber(-0.02, 0.03));
          updatedValue = Math.max(35.6, Math.min(130.2, value * expectancyChange));
        }
        break;
      case "Homeownership Rate": {
          let happinessImpact = (PopulationHappiness - 0.5) * 0.1;
          let inflationEffect = (Inflation - 0.04) * 0.1;
          let PovertyEffect = (PovertyRate - 0.04) * 0.1;
          updatedValue = value * (1 + BaseChange + global.HomeownershipRateChange + PovertyEffect + inflationEffect + happinessImpact + getRandomNumber(-0.02, 0.03));
        }
        break;
      case "Crime Rate":
        updatedValue = value * (1 + BaseChange + global.CrimeRateChange + ((Unemployment - 0.04) * 0.1 + (PovertyRate - 0.04) * 0.1) + getRandomNumber(-0.02, 0.03));
        break;
      case "Population":
        updatedPopulation = Math.round(value * (1 + BaseChange + global.PopulationChange + (PovertyRate - 0.04) * 0.1 + (PopulationHappiness - 0.5) * 0.1 + getRandomNumber(-0.02, 0.03)));
        updatedValue = updatedPopulation;
        break;
      case "Pop Growth Rate":
        updatedValue = ((updatedPopulation - previousPopulation) / (previousPopulation || 1));
        break;
      case "Primary Education":
        
        updatedValue = value * (1 + BaseChange + global.PrimaryEducationChange + (-(PovertyRate - 0.04) * 0.1) + getRandomNumber(-0.02, 0.03));
        break;
      case "Secondary Education":
        updatedValue = value * (1 + BaseChange + global.SecondaryEducationChange + (-(PovertyRate - 0.04) * 0.1) + getRandomNumber(-0.02, 0.03));
        break;
      case "Tertiary Education":
        updatedValue = value * (1 + BaseChange + global.TertiaryEducationChange + (-(PovertyRate - 0.04) * 0.1) + getRandomNumber(-0.02, 0.03));
        break;
      default:
        break;
    }
    updatedKeyMetrics[metric] = updatedValue;
  }
  // Replace "Average Income" with the weighted average income computed from income groups.
  updatedKeyMetrics["Average Income"] = weightedAvgIncome;

  // Log Key Metrics
  for (const metric of keyMetricsList) {
    let oldValue = metricsData[metric] || 0;
    let newValue = updatedKeyMetrics[metric] || 0;
    let percentageChange = ((newValue - oldValue) / (oldValue || 1)) * 100;
    let color = Math.abs(percentageChange) < 0.001 ? '\x1b[33m' :
                Math.abs(percentageChange) >= 25 ? '\x1b[35m' :
                percentageChange > 0 ? '\x1b[32m' : '\x1b[31m';
    console.log(`\nName: ${metric}`);
    console.log(`Old Value: ${oldValue.toFixed(3)}`);
    console.log(`New Value: ${newValue.toFixed(3)}`);
    console.log(`% change: ${color}${percentageChange.toFixed(3)}%\x1b[0m`);
  }

  // ─── SAVE ALL DATA ─────────────────────────
  for (const tax in TaxRates) {
    await editCsv(taxFilePath, tax, "Rate", (TaxRates[tax] * 100).toFixed(3) + "%");
  }
  for (const pd of popData) {
    await editCsv(popFilePath, pd.group, "Trust in Government", pd.newTrust.toFixed(4));
    await editCsv(popFilePath, pd.group, "Size", pd.normSize.toFixed(4));
    if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
      await editCsv(popFilePath, pd.group, "Avg Income", pd.newAvgIncome.toFixed(3));
    }
  }
  for (const sector of sectorsList) {
    let newValue = computedSectors[sector] || 0;
    await editCsv(econFilePath, sector, "One Time", "0");
    await editCsv(econFilePath, sector, "Government Spending/Subsidies", "0");
    await editCsv(econFilePath, sector, "Base Size", newValue.toFixed(3));
  }
  for (const metric in updatedKeyMetrics) {
    await editCsv(metricsFilePath, metric, "Value", updatedKeyMetrics[metric].toFixed(3));
  }

  console.log("All data updated successfully!");
}

module.exports = { RunEndofMonth };

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { downloadSheets, readCell, editCsv } = require('./googleSheetsHandler.js');

let year = new Date().toLocaleString('default', { year: "numeric" });
year = parseInt(year) - 1045;

// Get current month name
let month = new Date().toLocaleString('default', { month: 'long' });
console.log(`Processing budget for ${month} ${year}`);

// ─── HELPER CLASS ─────────────────────────────
class Utils {
  static getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
  }
  static formatPercentage(change) {
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

  // Function to log messages to a file
  static logToFile(message) {
    const logFilePath = `${month} ${year} End Of Month.log`;
    const timestamp = new Date().toISOString();

    // Strip ANSI color codes (e.g., \x1b[0m, \x1b[31m, etc.)
    const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');

    const logMessage = `[${timestamp}] ${cleanMessage}\n`;

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}


  // Function to delete a file
  static deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted file: ${filePath}`);
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }
}

// ─── File Path Structure ─────────────────────────────
const FilePaths = {
  Staff_Database: {
    taxes: `./csv_files/shared/Staff_Database_TaxesData.csv`,
    GovernmentData: `./csv_files/shared/Staff_Database_GovernmentData.csv`,
    MetricsData: './csv_files/shared/Staff_Database_MetricsData.csv',
    EconomicSector: `./csv_files/shared/Staff_Database_EconomicSectorData.csv`
  },
  Budget: {
    Totals: `./csv_files/shared/Union_Budget_of_${month}_${year}_Totals.csv`,
    Taxes: `./csv_files/shared/Union_Budget_of_${month}_${year}_Taxes.csv`,
    Administrive: `./csv_files/shared/Union_Budget_of_${month}_${year}_Administrive.csv`
  },
  Novum_Domitros: {
    Data: `./csv_files/regions/Novum_Domitros_Database_Novum_Domitros.csv`,
    Novum_Centrum: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Novum Centrum.csv`
    },
    Ventus: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Ventus.csv`
    },
    Visus_Primus: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Visus Primus.csv`
    },
    Terra_Cibus: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Terra Cibus.csv`
    },
    Portus: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Portus.csv`
    },
    Lacus: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Lacus.csv`
    },
    Trinus_Point: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Trinus Point.csv`
    },
    Stella: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Stella.csv`
    },
    Harena: {
      Data: `./csv_files/regions/Novum_Domitros_Database_Harena.csv`
    }
  }
};

// ─── POPULATION GROUP CLASSES ─────────────────────────────
class PopulationGroup {
  constructor(name, size = 0, trust = 0, avgIncome = null) {
    this.name = name;
    this.size = size;
    this.trust = trust;
    this.avgIncome = avgIncome; // only for income groups
    // Values calculated at end-of-month
    this.newSize = 0;
    this.normSize = 0;
    this.newTrust = 0;
    this.newAvgIncome = 0;
  }
}

class PopulationGroupSet {
  constructor(name, groupNames) {
    this.name = name;
    this.groups = {};
    groupNames.forEach(gName => {
      this.groups[gName] = new PopulationGroup(gName);
    });
  }
  // Validate that sizes sum to 1.0
  validateSizes() {
    const total = Object.values(this.groups).reduce((sum, group) => sum + group.size, 0);
    if (Math.abs(total - 1.0) > 1e-6) {
      console.error(`Set "${this.name}" sizes sum to ${total}, expected 1.0`);
      return false;
    }
    console.log(`PopulationGroupSet "${this.name}" validated: Total size = ${total}`);
    Utils.logToFile(`PopulationGroupSet "${this.name}" validated: Total size = ${total}`);
    return true;
  }
}

// ─── REGION CLASS ─────────────────────────────
// Each region reads from shared files and saves its updated data to a region‑specific CSV file.
class Region {
  constructor(name) {
    this.name = name;
    // Get region specific file path
    const regionKey = this.name.replace(/ /g, '_');
    // Use FilePaths structure to get region file path
    this.regionFilePath = FilePaths.Novum_Domitros[regionKey]?.Data;
    
    // Shared file paths
    this.sharedTaxFilePath = FilePaths.Budget.Taxes;
    this.sharedTaxesDataFilePath = FilePaths.Staff_Database.taxes;
    this.sharedTotalsFilePath = FilePaths.Budget.Totals;
    this.sharedMetricsFilePath = FilePaths.Staff_Database.MetricsData;
    this.sharedEconFilePath = FilePaths.Staff_Database.EconomicSector;
    
    // Output file path for this region
    this.regionOutputPath = this.regionFilePath;

    // Base Changes
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

    this.populationGroupsList = [
      "Capitalist", "Socialist",
      "Liberal", "Conservative",
      "Religious", "Non Religious",
      "Youth", "Adult", "Seniors",
      "Low Income", "Medium Income", "High Income"
    ];
    this.sectorsList = [
      "Office", "Construction", "Healthcare", "Manufacturing", "Real Estate",
      "Finance", "Retail", "Agriculture", "Forestry", "Defence",
      "Fishing", "Information", "Transport", "Electricity", "Water",
      "Mining", "Education", "Other"
    ];
    this.keyMetricsList = [
      "Population Happiness", "Inflation", "GDP", "Interest Rate", "Average Income", "Unemployment",
      "Productivity", "Financial Malpractice", "Poverty Rate", "Life Expectancy",
      "Population", "Pop Growth Rate", "Homeownership Rate", "Crime Rate", "Primary Education",
      "Secondary Education", "Tertiary Education", "Consumer Spending", "Big Mac Index"
    ];
    this.popGroupSets = {
      "Political": new PopulationGroupSet("Political", ["Liberal", "Conservative"]),
      "Economic": new PopulationGroupSet("Economic", ["Capitalist", "Socialist"]),
      "Age": new PopulationGroupSet("Age", ["Youth", "Adult", "Seniors"]),
      "Religious": new PopulationGroupSet("Religious", ["Religious", "Non Religious"]),
      "Income": new PopulationGroupSet("Income", ["Low Income", "Medium Income", "High Income"])
    };
    this.TaxRates = {
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
    this.PopulationHappiness = 0.5;
    this.PowerGenerationRatio = 2600000;
    this.PoliceStationRatio = 300000;
    this.InternetTowersRatio = 2000000;
    this.CommunicationsTowersRatio = 2200000;
    this.HospitalsRatio = 3500000;
  }

  async runCalculations() {
    console.log(`\n--- Processing Region: ${this.name} ---`);
    Utils.logToFile(`\n--- Processing Region: ${this.name} ---`);

   // READ SHARED DATA (using header row 2)
   console.log(`[${this.name}] Loading tax effects from ${this.sharedTaxesDataFilePath}`);
   Utils.logToFile(`[${this.name}] Loading tax effects from ${this.sharedTaxesDataFilePath}`);
   let taxEffects = {};
   for (const tax in this.TaxRates) {
     let effect1Str = await readCell(this.sharedTaxesDataFilePath, tax, "Effect on Pop", 2);
     let effect2Str = await readCell(this.sharedTaxesDataFilePath, tax, "Effect on Pop 2", 2);
     taxEffects[tax] = {
       effect1: parseFloat(effect1Str.replace(/[^0-9.]/g, '')) || 0,
       effect2: parseFloat(effect2Str.replace(/[^0-9.]/g, '')) || 0
     };
   }

   console.log(`[${this.name}] Loading population data from ${this.regionFilePath}`);
   Utils.logToFile(`[${this.name}] Loading population data from ${this.regionFilePath}`);
   let popData = [];
   for (const group of this.populationGroupsList) {
      let trustStr = await readCell(this.regionFilePath, group + ' Trust in Government', "Data", 2);
      let sizeStr = await readCell(this.regionFilePath, group + ' Size', "Data", 2);
      let avgIncome = null;
      if (["Low Income", "Medium Income", "High Income"].includes(group)) {
        let incomeStr = await readCell(this.regionFilePath, group + ' Avg Income', "Data", 2);
        avgIncome = parseFloat(incomeStr.replace(/[^0-9.]/g, '')) || 0;
      }
      let trust = parseFloat(trustStr.replace(/[^0-9.-]/g, '')) || 0;
      let size = parseFloat(sizeStr.replace(/[^0-9.-]/g, '')) || 0;
      popData.push({ group, trust, size, avgIncome });
   }

   console.log(`[${this.name}] Loading economic sector data from ${this.sharedEconFilePath}`);
   Utils.logToFile(`[${this.name}] Loading economic sector data from ${this.sharedEconFilePath}`);
   let sectorData = {};
   for (const sector of this.sectorsList) {
     let baseSizeStr = await readCell(this.regionFilePath, sector, "Data", 2);
     let oneTimeStr = await readCell(this.sharedEconFilePath, sector, "One Time", 2);
     let govSpendingStr = await readCell(this.sharedEconFilePath, sector, "Government Spending/Subsidies", 2);
     let csEffectStr = await readCell(this.sharedEconFilePath, sector, "Consumer Spending Effect", 2);
     let baseSize = parseFloat(baseSizeStr.replace(/[^0-9.]/g, '')) || 0;
     let oneTime = parseFloat(oneTimeStr.replace(/[^0-9.]/g, '')) || 0;
     let govSpending = parseFloat(govSpendingStr.replace(/[^0-9.]/g, '')) || 0;
     let csEffect = parseFloat(csEffectStr.replace(/[^0-9.-]/g, '')) || 0;
     sectorData[sector] = { baseSize, oneTime, govSpending, csEffect };
   }

    console.log(`[${this.name}] Loading administrative spending from ${this.sharedTotalsFilePath}`);
    Utils.logToFile(`[${this.name}] Loading administrative spending from ${this.sharedTotalsFilePath}`);
    let adminStr = await readCell(this.sharedTotalsFilePath, "Administrive", "Amount", 2);
    let adminNum = parseFloat(adminStr.replace("$Bn", "").replace(/,/g, "").trim()) || 0;
    adminNum = adminNum * 1000000;
    console.log(`[${this.name}] Administrative Spending: ${adminNum}`);
    Utils.logToFile(`[${this.name}] Administrative Spending: ${adminNum}`);

    console.log(`[${this.name}] Loading key metrics from ${this.sharedMetricsFilePath}`);
    Utils.logToFile(`[${this.name}] Loading key metrics from ${this.sharedMetricsFilePath}`);
    let metricsData = {};
    for (const metric of this.keyMetricsList) {
        let cellValue = await readCell(this.regionFilePath, metric, "Data", 2);
    
        // Check if cellValue is undefined or null
        if (cellValue === undefined || cellValue === null) {
            console.log(`[${this.name}] Metric ${metric} not found in region data, falling back to shared metrics.`);
            Utils.logToFile(`[${this.name}] Metric ${metric} not found in region data, falling back to shared metrics.`);
            cellValue = await readCell(this.sharedMetricsFilePath, metric, "Value", 2);
        }
    
        // If still undefined or null, log an error and set the value to 0
        if (cellValue === undefined || cellValue === null) {
            console.log(`[${this.name}] Metric ${metric} not found in both region and shared metrics, defaulting to 0.`);
            Utils.logToFile(`[${this.name}] Metric ${metric} not found in both region and shared metrics, defaulting to 0.`);
            metricsData[metric] = 0;
        } else {
            // Only parse if cellValue is a valid string
            let value = parseFloat(cellValue.replace(/[^0-9.-]/g, '')) || 0;
            metricsData[metric] = value;
        }
    }
  

    // Perform calculations (using global variables for changes)
    console.log(`[${this.name}] Performing calculations...`);
    Utils.logToFile(`[${this.name}] Performing calculations...`);
    global.ConsumerSpendingChange = 0.10
      - this.TaxRates["Income Low"] * taxEffects["Income Low"].effect1
      - this.TaxRates["Income Medium"] * taxEffects["Income Medium"].effect1
      - this.TaxRates["Income High"] * taxEffects["Income High"].effect1
      - this.TaxRates["GST"] * taxEffects["GST"].effect1
      + this.TaxRates["Savings Tax"] * taxEffects["Savings Tax"].effect1;

    global.PovertyRateChange =
      this.TaxRates["Income Low"] * taxEffects["Income Low"].effect2 +
      this.TaxRates["Income Medium"] * taxEffects["Income Medium"].effect2 +
      this.TaxRates["Income High"] * taxEffects["Income High"].effect2 +
      this.TaxRates["Savings Tax"] * taxEffects["Savings Tax"].effect2;

    global.EconomicGrowth = 0.01
      - this.TaxRates["Local Government Levy"] * taxEffects["Local Government Levy"].effect1
      - this.TaxRates["Office"] * taxEffects["Office"].effect1
      - this.TaxRates["Construction"] * taxEffects["Construction"].effect1
      - this.TaxRates["Healthcare"] * taxEffects["Healthcare"].effect1
      - this.TaxRates["Manufacturing"] * taxEffects["Manufacturing"].effect1
      - this.TaxRates["Real Estate"] * taxEffects["Real Estate"].effect1
      - this.TaxRates["Finance"] * taxEffects["Finance"].effect1
      - this.TaxRates["Retail"] * taxEffects["Retail"].effect1
      - this.TaxRates["Agriculture"] * taxEffects["Agriculture"].effect1
      - this.TaxRates["Forestry"] * taxEffects["Forestry"].effect1
      - this.TaxRates["Fishing"] * taxEffects["Fishing"].effect1
      - this.TaxRates["Defence"] * taxEffects["Defence"].effect1
      - this.TaxRates["Information"] * taxEffects["Information"].effect1
      - this.TaxRates["Transport"] * taxEffects["Transport"].effect1
      - this.TaxRates["Electricity"] * taxEffects["Electricity"].effect1
      - this.TaxRates["Water"] * taxEffects["Water"].effect1
      - this.TaxRates["Mining"] * taxEffects["Mining"].effect1
      - this.TaxRates["Education"] * taxEffects["Education"].effect1;

    global.InflationRate = this.TaxRates["GST"] * taxEffects["GST"].effect2;

    global.UnemploymentRate =
      this.TaxRates["Office"] * taxEffects["Office"].effect2 +
      this.TaxRates["Construction"] * taxEffects["Construction"].effect2 +
      this.TaxRates["Healthcare"] * taxEffects["Healthcare"].effect2 +
      this.TaxRates["Manufacturing"] * taxEffects["Manufacturing"].effect2 +
      this.TaxRates["Real Estate"] * taxEffects["Real Estate"].effect2 +
      this.TaxRates["Finance"] * taxEffects["Finance"].effect2 +
      this.TaxRates["Retail"] * taxEffects["Retail"].effect2 +
      this.TaxRates["Agriculture"] * taxEffects["Agriculture"].effect2 +
      this.TaxRates["Forestry"] * taxEffects["Forestry"].effect2 +
      this.TaxRates["Fishing"] * taxEffects["Fishing"].effect2 +
      this.TaxRates["Defence"] * taxEffects["Defence"].effect2 +
      this.TaxRates["Information"] * taxEffects["Information"].effect2 +
      this.TaxRates["Transport"] * taxEffects["Transport"].effect2 +
      this.TaxRates["Electricity"] * taxEffects["Electricity"].effect2 +
      this.TaxRates["Water"] * taxEffects["Water"].effect2 +
      this.TaxRates["Mining"] * taxEffects["Mining"].effect2 +
      this.TaxRates["Education"] * taxEffects["Education"].effect2;

    let totalTrust = 0, totalPop = 0;
    for (const pd of popData) {
      totalTrust += pd.trust * pd.size;
      totalPop += pd.size;
    }
    this.PopulationHappiness = totalPop > 0 ? totalTrust / totalPop : 0.5;
    this.PopulationHappiness = Math.max(0.4, Math.min(0.6, this.PopulationHappiness));
    console.log(`[${this.name}] Calculated Population Happiness: ${this.PopulationHappiness.toFixed(3)}`);
    Utils.logToFile(`[${this.name}] Calculated Population Happiness: ${this.PopulationHappiness.toFixed(3)}`);

    console.log(`[${this.name}] Original Population Data:`);
    Utils.logToFile(`[${this.name}] Original Population Data:`);
    popData.forEach(pd => console.log(`  ${pd.group}: Trust=${pd.trust.toFixed(3)}, Size=${pd.size.toFixed(3)}`));

    console.log(`[${this.name}] Processing economic sector data...`);
    Utils.logToFile(`[${this.name}] Processing economic sector data...`);
    let computedSectors = {};
    for (const sector of this.sectorsList) {
      if (sector === "Illicit") continue;
      let { baseSize, oneTime, govSpending, csEffect } = sectorData[sector];
      let intermediateValue = (baseSize + (oneTime * 0.25) + (govSpending * 0.60)) * (1 + global.EconomicGrowth);
      let finalValue = intermediateValue * (1 + (global.ConsumerSpendingChange * csEffect));
      finalValue = finalValue * (1 + Utils.getRandomNumber(-0.015, 0.015));
      if (sector === "Public Service") {
        finalValue = adminNum * (1 + Utils.getRandomNumber(-0.045, -0.035));
      }
      computedSectors[sector] = finalValue;
      let percentageChange = ((finalValue - baseSize) / (baseSize || 1)) * 100;
      const logMsg = [
        `[${this.name}] Sector: ${sector}`,
        `  Old Value: ${baseSize.toFixed(3)}`,
        `  Intermediate Value: ${intermediateValue.toFixed(3)}`,
        `  CS Effect: ${csEffect.toFixed(3)}`,
        `  Final Value: ${finalValue.toFixed(3)}`,
        `  % Change: ${Utils.formatPercentage(percentageChange)}`
      ].join('\n');
      
      console.log(logMsg);
      Utils.logToFile(logMsg);
    }

    console.log(`[${this.name}] Processing Illicit sector...`);
    Utils.logToFile(`[${this.name}] Processing Illicit sector...`);
    let preliminaryGDP = 0;
    for (const s in computedSectors) {
      preliminaryGDP += computedSectors[s];
    }
    let crimeRate = metricsData["Crime Rate"] || 0;
    let illicitValue = preliminaryGDP * crimeRate;
    computedSectors["Illicit"] = illicitValue;
    let illicitOldStr = await readCell(this.sharedEconFilePath, "Illicit", "Base Size", 2);
    let illicitOld = parseFloat(illicitOldStr.replace(/[^0-9.]/g, '')) || 0;
    let illicitPercentageChange = ((illicitValue - illicitOld) / (illicitOld || 1)) * 100;
    const illicitLogMsg = [
      `[${this.name}] Sector: Illicit`,
      `  Old Value: ${illicitOld.toFixed(3)}`,
      `  New Value: ${illicitValue.toFixed(3)}`,
      `  % Change: ${Utils.formatPercentage(illicitPercentageChange)}`
    ].join('\n');
    
    console.log(illicitLogMsg);
    Utils.logToFile(illicitLogMsg);
    

    let finalGDP = 0;
    for (const s of this.sectorsList) {
      if (computedSectors[s] !== undefined) {
        finalGDP += computedSectors[s];
      }
    }
    let oldGDPMetric = metricsData["GDP"] || 1000;
    let computedGDPGrowth = finalGDP / oldGDPMetric - 1;
    console.log(`[${this.name}] Computed GDP Growth: ${(computedGDPGrowth * 100).toFixed(3)}%`);
    Utils.logToFile(`[${this.name}] Computed GDP Growth: ${(computedGDPGrowth * 100).toFixed(3)}%`);

    console.log(`[${this.name}] Adjusting population groups...`);
    Utils.logToFile(`[${this.name}] Adjusting population groups...`);
    for (const setName in this.popGroupSets) {
      const setObj = this.popGroupSets[setName];
      const groups = Object.keys(setObj.groups);
      let originalTotal = groups.reduce((sum, g) => {
        let popItem = popData.find(p => p.group === g);
        return popItem ? sum + popItem.size : sum;
      }, 0);
      let randomized = {};
      let sumRandom = 0;
      for (const g of groups) {
        let popItem = popData.find(p => p.group === g);
        if (popItem) {
          let randSize = popItem.size * (1 + Utils.getRandomNumber(-0.04, 0.04));
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
    popData.forEach(pd => {
      let inSet = false;
      for (const setName in this.popGroupSets) {
        if (this.popGroupSets[setName].groups.hasOwnProperty(pd.group)) {
          inSet = true;
          break;
        }
      }
      if (!inSet) {
        pd.newSize = pd.size * (1 + Utils.getRandomNumber(-0.04, 0.04));
      }
    });
    let totalNewSizeAll = popData.reduce((sum, p) => sum + p.newSize, 0);
    popData.forEach(pd => {
      pd.normSize = pd.newSize / totalNewSizeAll;
    });
    popData.forEach(pd => {
      pd.newTrust = pd.trust * (1 + 0.02 + Utils.getRandomNumber(-0.04, 0.04));
      if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
        pd.newAvgIncome = pd.avgIncome * (1 + computedGDPGrowth + Utils.getRandomNumber(-0.02, 0.03));
      }
    });
    let totalIncome = 0, totalIncomeWeight = 0;
    popData.forEach(pd => {
      if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
        totalIncome += pd.newAvgIncome * pd.normSize;
        totalIncomeWeight += pd.normSize;
      }
    });
    let weightedAvgIncome = totalIncomeWeight > 0 ? totalIncome / totalIncomeWeight : 0;
    console.log(`[${this.name}] Population Adjustments:`);
    Utils.logToFile(`[${this.name}] Population Adjustments:`);
    popData.forEach(pd => {
      console.log(`  ${pd.group}: Old Trust=${pd.trust.toFixed(3)}, New Trust=${pd.newTrust.toFixed(3)}, Old Size=${pd.size.toFixed(3)}, New Norm Size=${pd.normSize.toFixed(3)}`);
      Utils.logToFile(`  ${pd.group}: Old Trust=${pd.trust.toFixed(3)}, New Trust=${pd.newTrust.toFixed(3)}, Old Size=${pd.size.toFixed(3)}, New Norm Size=${pd.normSize.toFixed(3)}`);
      if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
        console.log(`    Old Avg Income=${pd.avgIncome.toFixed(3)}, New Avg Income=${pd.newAvgIncome.toFixed(3)}`);
        Utils.logToFile(`    Old Avg Income=${pd.avgIncome.toFixed(3)}, New Avg Income=${pd.newAvgIncome.toFixed(3)}`);
      }
    });
    console.log(`[${this.name}] Weighted Average Income for Income Groups: ${weightedAvgIncome.toFixed(3)}`);
    Utils.logToFile(`[${this.name}] Weighted Average Income for Income Groups: ${weightedAvgIncome.toFixed(3)}`);
    let totalNewTrust = popData.reduce((sum, pd) => sum + pd.newTrust * pd.normSize, 0);
    this.PopulationHappiness = totalNewTrust;
    console.log(`[${this.name}] Recalculated Population Happiness: ${this.PopulationHappiness.toFixed(3)}`);
    Utils.logToFile(`[${this.name}] Recalculated Population Happiness: ${this.PopulationHappiness.toFixed(3)}`);

    console.log(`[${this.name}] Updating key metrics...`);
    Utils.logToFile(`[${this.name}] Updating key metrics...`);
    let Inflation = metricsData["Inflation"] || 2;
    let Unemployment = metricsData["Unemployment"] || 5;
    let PovertyRate = metricsData["Poverty Rate"] || 10;
    let previousPopulation = metricsData["Population"] || 0;
    let updatedPopulation = previousPopulation;
    let updatedKeyMetrics = {};
    let BaseChange = 0.01;
    for (const metric of this.keyMetricsList) {
      let value = metricsData[metric] || 0;
      let updatedValue = value;
      switch (metric) {
        case "Population Happiness":
          updatedValue = this.PopulationHappiness;
          break;
        case "Inflation":
          updatedValue = value * (1 + BaseChange + global.InflationRate + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Big Mac Index":
          updatedValue = value * (1 + Inflation);
          break;
        case "GDP":
          updatedValue = finalGDP;
          updatedKeyMetrics["GDP"] = finalGDP;
          break;
        case "Consumer Spending":
          updatedValue = value * (1 + BaseChange + global.ConsumerSpendingChange + computedGDPGrowth + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Unemployment":
          updatedValue = value * (1 + BaseChange + global.UnemploymentRate - computedGDPGrowth + Utils.getRandomNumber(-0.03, 0.02));
          break;
        case "Productivity":
          updatedValue = value * (1 + BaseChange + global.ProductivityChange + (this.PopulationHappiness - 0.5) * 0.1 + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Financial Malpractice":
          updatedValue = value * (1 + BaseChange + global.FinancialMalpracticeChange + ((Inflation - computedGDPGrowth / 2) + Utils.getRandomNumber(-0.02, 0.03)));
          break;
        case "Poverty Rate":
          updatedValue = value * (1 + BaseChange + global.PovertyRateChange + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Life Expectancy": {
            let happinessFactor = (this.PopulationHappiness - 0.5) * 0.1;
            let inflationEffect = (-Inflation + 0.04) * 0.1;
            let expectancyChange = 1 + BaseChange + happinessFactor + inflationEffect + Utils.getRandomNumber(-0.02, 0.03);
            updatedValue = Math.max(35.6, Math.min(130.2, value * expectancyChange));
          }
          break;
        case "Homeownership Rate": {
            let happinessImpact = (this.PopulationHappiness - 0.5) * 0.1;
            let inflationEffect = (Inflation - 0.04) * 0.1;
            let PovertyEffect = (PovertyRate - 0.04) * 0.1;
            updatedValue = value * (1 + BaseChange + global.HomeownershipRateChange + PovertyEffect + inflationEffect + happinessImpact + Utils.getRandomNumber(-0.02, 0.03));
          }
          break;
        case "Crime Rate":
          updatedValue = value * (1 + BaseChange + global.CrimeRateChange + ((Unemployment - 0.04) * 0.1 + (PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Population":
          updatedPopulation = Math.round(value * (1 + BaseChange + global.PopulationChange + (PovertyRate - 0.04) * 0.1 + (this.PopulationHappiness - 0.5) * 0.1 + Utils.getRandomNumber(-0.02, 0.03)));
          updatedValue = updatedPopulation;
          break;
        case "Pop Growth Rate":
          updatedValue = ((updatedPopulation - previousPopulation) / (previousPopulation || 1));
          break;
        case "Primary Education":
          updatedValue = value * (1 + BaseChange + global.PrimaryEducationChange - ((PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Secondary Education":
          updatedValue = value * (1 + BaseChange + global.SecondaryEducationChange - ((PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Tertiary Education":
          updatedValue = value * (1 + BaseChange + global.TertiaryEducationChange - ((PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        default:
          break;
      }
      updatedKeyMetrics[metric] = updatedValue;
    }
    updatedKeyMetrics["Average Income"] = weightedAvgIncome;
    console.log(`[${this.name}] Updated Key Metrics:`);
    Utils.logToFile(`[${this.name}] Updated Key Metrics:`);
    for (const metric of this.keyMetricsList) {
      let oldValue = metricsData[metric] || 0;
      let newValue = updatedKeyMetrics[metric] || 0;
      let percentageChange = ((newValue - oldValue) / (oldValue || 1)) * 100;
      let color = Math.abs(percentageChange) < 0.001 ? '\x1b[33m' :
                  Math.abs(percentageChange) >= 25 ? '\x1b[35m' :
                  percentageChange > 0 ? '\x1b[32m' : '\x1b[31m';
      const metricLogMsg = [
        `[${this.name}] Metric: ${metric}`,
        `  Old Value: ${oldValue.toFixed(3)}`,
        `  New Value: ${newValue.toFixed(3)}`,
        `  % Change: ${color}${percentageChange.toFixed(3)}%\x1b[0m`
      ].join('\n');
      
      console.log(metricLogMsg);
      Utils.logToFile(metricLogMsg);       
    }

    // SAVE REGION-SPECIFIC OUTPUT
    console.log(`[${this.name}] Saving updated data to ${this.regionOutputPath} ...`);
    Utils.logToFile(`[${this.name}] Saving updated data to ${this.regionOutputPath} ...`);
    
    // Save updated population data
    // for (const pd of popData) {
    //   await editCsv(this.regionOutputPath, pd.group, "Trust in Government", pd.newTrust.toFixed(4));
    //   await editCsv(this.regionOutputPath, pd.group, "Size", pd.normSize.toFixed(4));
    //   console.log(`[${this.name}] Saved updated data for population group ${pd.group}`);
    //   if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
    //     await editCsv(this.regionOutputPath, pd.group, "Avg Income", pd.newAvgIncome.toFixed(3));
    //     console.log(`[${this.name}] Updated Avg Income for ${pd.group}`);
    //   }
    // }

    // Save updated economic sector data
    // for (const sector of this.sectorsList) {
    //   let newValue = computedSectors[sector] || 0;
    //   await editCsv(this.regionOutputPath, sector, "One Time", "0");
    //   await editCsv(this.regionOutputPath, sector, "Government Spending/Subsidies", "0");
    //   await editCsv(this.regionOutputPath, sector, "Base Size", newValue.toFixed(3));
    //   console.log(`[${this.name}] Saved updated economic data for sector ${sector}`);
    // }

    // Save updated key metrics data
    // for (const metric in metricsData) {
    //   await editCsv(this.regionOutputPath, metric, "Data", metricsData[metric].toFixed(3));
    //   console.log(`[${this.name}] Saved updated key metric ${metric}`);
    // }

    console.log(`--- Completed Processing Region: ${this.name} ---`);
    Utils.logToFile(`--- Completed Processing Region: ${this.name} ---`);
    // Return key metrics for aggregation
    return updatedKeyMetrics;
  }
}

// ─── PLANET CLASS ─────────────────────────────
// A planet contains one or more regions. Its processing aggregates the regions' key metrics,
// and saves the aggregated data to a planet‑specific CSV file.
class Planet {
  constructor(name, regionNames) {
    this.name = name;
    // Use FilePaths structure to get region file path
    this.planetOutputPath = FilePaths.Novum_Domitros.Data;

    this.regions = regionNames.map(rName => new Region(rName));
    this.aggregatedMetrics = {};
  }

  async runEndOfMonth() {
    console.log(`\n=== Processing Planet: ${this.name} ===`);
    Utils.logToFile(`\n=== Processing Planet: ${this.name} ===`);
    let allRegionMetrics = [];
    for (const region of this.regions) {
      let regionMetrics = await region.runCalculations();
      allRegionMetrics.push(regionMetrics);
    }
    // Aggregate metrics by summing across regions
    let aggregated = {};
    for (const metrics of allRegionMetrics) {
      for (const key in metrics) {
        if (!aggregated[key]) aggregated[key] = 0;
        aggregated[key] += metrics[key];
      }
    }
    this.aggregatedMetrics = aggregated;
    console.log(`\n=== Aggregated Metrics for Planet ${this.name} ===`);
    Utils.logToFile(`\n=== Aggregated Metrics for Planet ${this.name} ===`);
    for (const key in aggregated) {
      console.log(`${key}: ${aggregated[key].toFixed(3)}`);
      Utils.logToFile(`${key}: ${aggregated[key].toFixed(3)}`);
    }
    // Save aggregated metrics to planet output file
    console.log(`[${this.name}] Saving aggregated metrics to ${this.planetOutputPath} ...`);
    Utils.logToFile(`[${this.name}] Saving aggregated metrics to ${this.planetOutputPath} ...`);
    // for (const key in aggregated) {
    //   await editCsv(this.planetOutputPath, key, "Data", aggregated[key].toFixed(3));
    //   console.log(`Saved aggregated metric ${key} for planet ${this.name}`);
    // }
    console.log(`=== Completed Processing Planet: ${this.name} ===`);
    Utils.logToFile(`=== Completed Processing Planet: ${this.name} ===`);
  }
}

// ─── GLOBAL END-OF-MONTH PROCESSOR ─────────────────────────────
class EndOfMonthProcessor {
  constructor() {
    // Create one planet named "Novem Domitros" with the specified regions.
    const regionNames = [
      "Novum Centrum",
      "Ventus",
      "Visus Primus",
      "Terra Cibus",
      "Portus",
      "Lacus",
      "Trinus Point",
      "Stella",
      "Harena"
    ];
    this.planets = [
      new Planet("Novem Domitros", regionNames)
    ];
  }

  async run() {
    console.log("\n=== Starting Global End-of-Month Process ===");
    Utils.logToFile("\n=== Starting Global End-of-Month Process ===");
    console.log("Downloading sheets...");
    Utils.logToFile("Downloading sheets...");
    // Download Data for End of Month
    // const DebugBudget = '1N4hG2GtuCBMhl0v8cuGUtHHjEFgKRYTzS3gBMGn7YwM';
    // await downloadSheets('1xbZDUz-k_DH929kd67F22ZMOWdAC1x5aa0IzcewoJuY', "./csv_files/shared"); // Staff DB
    // await downloadSheets('1jo5hThsjtMpwz03y00LO-hV3Gtl507c9alfm6_nCtxM', "csv_files/regions"); // Novum Domitros DB
    // await downloadSheets(DebugBudget, "./csv_files/shared");
    
    for (const planet of this.planets) {
      await planet.runEndOfMonth();
    }
    console.log("=== Global End-of-Month Process Completed ===");
    Utils.logToFile("=== Global End-of-Month Process Completed ===");
  }
}

const processor = new EndOfMonthProcessor();
processor.run();
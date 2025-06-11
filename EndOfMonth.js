require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { downloadSheets, readCell, editCsv } = require('./googleSheetsHandler.js');
const { StringDecoder } = require('string_decoder');

let year = new Date().toLocaleString('default', { year: "numeric" });
year = parseInt(year) - 1045;

// Get current month name
let month = new Date().toLocaleString('default', { month: 'long' });
console.log(`Processing budget for ${month} ${year}`);


// Local Council 15% of Local GDP
// 10% of Local Spending on new assets

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
    return `${color}${change.toFixed(4)}%\x1b[0m`;
  }

  // Function to log messages to a file
  static logToFile(message) {
    const logFilePath = `${month} ${year} End Of Month.log`;
    const timestamp = new Date().toISOString();
    const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
    const logMessage = `[${timestamp}] ${cleanMessage}\n`;
    try {
      fs.appendFileSync(logFilePath, logMessage);
    } catch (err) {
      console.error('Error writing to log file:', err);
    }
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
    EconomicSector: `./csv_files/shared/Staff_Database_EconomicSectorData.csv`,
    EOMTotals: `./csv_files/shared/Staff_Database_EOMTotals.csv`
  },
  Budget: {
    Totals: `./csv_files/shared/Union_Budget_of_${month}_${year}_Totals.csv`,
    Taxes: `./csv_files/shared/Union_Budget_of_${month}_${year}_Taxes.csv`,
    Administrive: `./csv_files/shared/Union_Budget_of_${month}_${year}_Administrive.csv`
  },
  Novum_Domitros: {
    Data: `./csv_files/regions/Novum_Domitros_Database_Novum Domitros.csv`,
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
    this.newSize = 0;
    this.newTrust = 0;
    this.newAvgIncome = 0;
  }
}

// ─── POPULATION GROUP SET CLASSES ─────────────────────────────
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
    this.sharedEOMTotalsFilePath = FilePaths.Staff_Database.EOMTotals;
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
      "Secondary Education", "Tertiary Education", "Consumer Spending", "Big Mac Index", "Government Asset Budget",
      "Police Stations needed", "Power Consumer", "Internet Towers Needed", "Communication Towers Needed", "Hospitals Needed"
    ];
    this.popGroupSets = {
      "Political": new PopulationGroupSet("Political", ["Liberal", "Conservative"]),
      "Economic": new PopulationGroupSet("Economic", ["Capitalist", "Socialist"]),
      "Age": new PopulationGroupSet("Age", ["Youth", "Adult", "Seniors"]),
      "Religious": new PopulationGroupSet("Religious", ["Religious", "Non Religious"]),
      "Income": new PopulationGroupSet("Income", ["Low Income", "Medium Income", "High Income"])
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

    const taxKeys = [
      "Income Low", "Income Medium", "Income High", "Local Government Levy", "GST", "Savings Tax",
      "Office", "Construction", "Healthcare", "Manufacturing", "Real Estate", "Finance",
      "Retail", "Agriculture", "Forestry", "Fishing", "Defence", "Information",
      "Transport", "Electricity", "Water", "Mining", "Education"
    ];
    
    const parseRate = async (key) => {
      const raw = await readCell(this.sharedTaxFilePath, key, "Rate");
      return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    };
    
    this.TaxRates = {};
    for (const key of taxKeys) {
      this.TaxRates[key] = await parseRate(key) / 1000;
    }
    
    console.log(`[${this.TaxRates[`Local Government Levy`]}] LGL`);
    Utils.logToFile(`[${this.TaxRates[`Local Government Levy`]}] LGL`);

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
     let baseSizeStr = await readCell(this.regionFilePath, sector, "Data");
     let oneTimeStr = await readCell(this.sharedEconFilePath, sector, "One Time");
     let govSpendingStr = await readCell(this.sharedEconFilePath, sector, "Government Spending/Subsidies");
     let csEffectStr = await readCell(this.sharedEconFilePath, sector, "Consumer Spending Effect");
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
    this.metricsData = {};
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
            this.metricsData[metric] = 0;
        } else {
            // Only parse if cellValue is a valid string
            let value = parseFloat(cellValue.replace(/[^0-9.-]/g, '')) || 0;
            this.metricsData[metric] = value;
        }
    }
  

    // Perform calculations (using global variables for changes)
    console.log(`[${this.name}] Performing calculations...`);
    Utils.logToFile(`[${this.name}] Performing calculations...`);


    // Applying Tax Effects
    global.ConsumerSpendingChange = 0.00
      - this.TaxRates["Income Low"] * taxEffects["Income Low"].effect1
      - this.TaxRates["Income Medium"] * taxEffects["Income Medium"].effect1
      - this.TaxRates["Income High"] * taxEffects["Income High"].effect1
      - this.TaxRates["GST"] * taxEffects["GST"].effect1
      + this.TaxRates["Savings Tax"] * taxEffects["Savings Tax"].effect1;

    global.PovertyRateChange = 0.00 +
      this.TaxRates["Income Low"] * taxEffects["Income Low"].effect2 +
      this.TaxRates["Income Medium"] * taxEffects["Income Medium"].effect2 +
      this.TaxRates["Income High"] * taxEffects["Income High"].effect2 +
      this.TaxRates["Savings Tax"] * taxEffects["Savings Tax"].effect2;

    global.EconomicGrowth = 0.00
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

    global.UnemploymentRate = 0.00 +
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


    // End of Month Totals
    let EndOfMonthGrowth = await readCell(this.sharedEOMTotalsFilePath, "Economic Growth", "Value");
    EndOfMonthGrowth = parseFloat(EndOfMonthGrowth.replace(/[^0-9.-]/g, '')) || 0.0;

    let totalTrust = 0, totalPop = 0;
    for (const pd of popData) {
      totalTrust += pd.trust * pd.size;
      totalPop += pd.size;
    }
    this.PopulationHappiness = totalPop > 0 ? totalTrust / totalPop : 0.5;
    this.PopulationHappiness = Math.max(0.4, Math.min(0.6, this.PopulationHappiness));
    console.log(`[${this.name}] Calculated Starting Population Happiness: ${this.PopulationHappiness.toFixed(4)}`);
    Utils.logToFile(`[${this.name}] Calculated Starting Population Happiness: ${this.PopulationHappiness.toFixed(4)}`);

    console.log(`[${this.name}] Original Population Data:`);
    Utils.logToFile(`[${this.name}] Original Population Data:`);
    popData.forEach(pd => console.log(`  ${pd.group}: Trust=${pd.trust.toFixed(4)}, Size=${pd.size.toFixed(4)}`));

    console.log(`[${this.name}] Processing economic sector data...`);
    Utils.logToFile(`[${this.name}] Processing economic sector data...`);
    let computedSectors = {};
    for (const sector of this.sectorsList) {
      // Ignore if illicit
      if (sector === "Illicit") continue;

      // Load Base Info
      let { baseSize, oneTime, govSpending, csEffect } = sectorData[sector];

      // Do first run of calc
      let intermediateValue = (baseSize + (oneTime * 0.25) + (govSpending * 0.60)) * (1 + global.EconomicGrowth + EndOfMonthGrowth);
      console.log(`[${this.name}] [${sector}] intermediateValue = ${intermediateValue}`);
      Utils.logToFile(`[${this.name}] [${sector}] intermediateValue = ${intermediateValue}`);

      // Load Key GDP metrics (1 month lag)
      let PrimaryEducationEffect = 0.03 * (1 - this.metricsData["Primary Education"] + 0.5);
      let SecondaryEducationEffect =  0.02 * (1 - this.metricsData["Secondary Education"] + 0.5);
      let TertiaryEducationEffect =  0.01 * (1 - this.metricsData["Tertiary Education"] + 0.5);
      let HeathEffect =  0.035 * (1 - this.metricsData["Life Expectancy"] / 65);
      let ProducityvityEffect = 0.10 * Math.abs(1000 - this.metricsData["Productivity"]) / 1000;
      let CrimeEffect =  0.015 * (1 - 0.5 - this.metricsData["Crime Rate"]);
      let HappinessEffect =  0.025 * (1 - this.metricsData["Population Happiness"] + 0.5);
      let IntrestRateEffect = 0.075 * (0.03 - this.metricsData["Interest Rate"]);

      // Setup Final Value
      let finalValue = intermediateValue *
        (1 +
        + (0.4 * (global.ConsumerSpendingChange * csEffect))
        + HappinessEffect
        + PrimaryEducationEffect
        + SecondaryEducationEffect
        + TertiaryEducationEffect
        + CrimeEffect
        + ProducityvityEffect
        + HeathEffect
        + IntrestRateEffect);
        
      finalValue = finalValue * (1 + Utils.getRandomNumber(-0.015, 0.015));
      if (sector === "Public Service") {
        finalValue = adminNum * (1 + Utils.getRandomNumber(-0.045, -0.035));
      }
      computedSectors[sector] = finalValue;
      let percentageChange = ((finalValue - baseSize) / (baseSize || 1)) * 100;
      const logMsg = [
        `[${this.name}] Sector: ${sector}`,
        `  Old Value: ${baseSize.toFixed(4)}`,
        `  Intermediate Value: ${intermediateValue.toFixed(4)}`,
        `  CS Effect: ${csEffect.toFixed(4)}`,
        `  Final Value: ${finalValue.toFixed(4)}`,
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
    let crimeRate = this.metricsData["Crime Rate"] || 0;
    let illicitValue = preliminaryGDP * crimeRate;
    computedSectors["Illicit"] = illicitValue;
    let illicitOldStr = await readCell(this.sharedEconFilePath, "Illicit", "Base Size", 2);
    let illicitOld = parseFloat(illicitOldStr.replace(/[^0-9.]/g, '')) || 0;
    let illicitPercentageChange = ((illicitValue - illicitOld) / (illicitOld || 1)) * 100;
    const illicitLogMsg = [
      `[${this.name}] Sector: Illicit`,
      `  Old Value: ${illicitOld.toFixed(4)}`,
      `  New Value: ${illicitValue.toFixed(4)}`,
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
    let oldGDPMetric = this.metricsData["GDP"] || 1000;
    let computedGDPGrowth = finalGDP / oldGDPMetric - 1;
    console.log(`[${this.name}] Computed GDP Growth: ${(computedGDPGrowth * 100).toFixed(4)}%`);
    Utils.logToFile(`[${this.name}] Computed GDP Growth: ${(computedGDPGrowth * 100).toFixed(4)}%`);

    console.log(`[${this.name}] Adjusting population groups...`);
    Utils.logToFile(`[${this.name}] Adjusting population groups...`);

    let EveryonePopChange = await readCell(this.sharedEOMTotalsFilePath, "Everyone", "Value");
    let CapitalistPopChange = await readCell(this.sharedEOMTotalsFilePath, "Capatalist Impact", "Value");
    let YouthPopChange = await readCell(this.sharedEOMTotalsFilePath, "Youth", "Value");
    let AdultPopChange = await readCell(this.sharedEOMTotalsFilePath, "Adult", "Value");
    let SeniorsPopChange = await readCell(this.sharedEOMTotalsFilePath, "Seniors", "Value");
    let ReligiousPopChange = await readCell(this.sharedEOMTotalsFilePath, "Religous Impact", "Value");
    let LowIncomePopChange = await readCell(this.sharedEOMTotalsFilePath, "Low Income", "Value");
    let MediumIncomePopChange = await readCell(this.sharedEOMTotalsFilePath, "Medium Income", "Value");
    let HighIncomePopChange = await readCell(this.sharedEOMTotalsFilePath, "High Income", "Value");

    const popChangeMap = {
      "Everyone": EveryonePopChange || 0,
      "Capitalist": CapitalistPopChange || 0,
      "Socialist": -CapitalistPopChange || 0,
      "Youth": YouthPopChange || 0,
      "Adult": AdultPopChange || 0,
      "Seniors": SeniorsPopChange || 0,
      "Religious": ReligiousPopChange || 0,
      "Non Religious" : -ReligiousPopChange || 0,
      "Low Income": LowIncomePopChange || 0,
      "Medium Income": MediumIncomePopChange || 0,
      "High Income": HighIncomePopChange || 0
    };

    // ─── Adjust Population Group Sizes Within Sets ───
    let incomeSum = 0, trustSum  = 0, popForTrust  = 0, popForIncome = 0;
    
    for (const setName in this.popGroupSets) {
      const set = this.popGroupSets[setName];
      const groupNames = Object.keys(set.groups);

      // Calculate the original total population of the group set
      let originalTotalSize = groupNames.reduce((sum, group) => {
        const entry = popData.find(p => p.group === group);
        return entry ? sum + entry.size : sum;
      }, 0);

      // Apply random variation to group sizes and accumulate total
      let randomizedSizes = {};
      let totalRandomizedSize = 0;
      for (const group of groupNames) {
        const entry = popData.find(p => p.group === group);
        if (entry) {
          const variedSize = entry.size * (1 + Utils.getRandomNumber(-0.04, 0.04));
          randomizedSizes[group] = variedSize;
          totalRandomizedSize += variedSize;
        }
      }

      // Normalize randomized sizes so the total matches the original
      for (const group of groupNames) {
        const entry = popData.find(p => p.group === group);
        if (entry) {
          entry.newSize = randomizedSizes[group] * (originalTotalSize / totalRandomizedSize);
        }
      }
    }

    // ─── Update Trust and Income ───
    popData.forEach(person => {

      const groupChange = parseFloat(popChangeMap[person.group]) || 0;
      const everyoneChange = parseFloat(popChangeMap.Everyone) || 0;
      const trustChange = groupChange + everyoneChange;

      const baseTrust = isFinite(person.trust) ? person.trust : 0;

      person.newTrust = baseTrust * (1 + trustChange + Utils.getRandomNumber(-0.02, 0.03));

      // accumulate for income
      if (["Low Income","Medium Income","High Income"].includes(person.group)) {
        person.newAvgIncome = person.avgIncome * (1 + computedGDPGrowth + Utils.getRandomNumber(-0.02, 0.03));
        incomeSum     += person.newAvgIncome * person.newSize;
        popForIncome   += person.newSize;
      }

      // accumulate for trust
      trustSum      += person.newTrust  * person.newSize;
      popForTrust   += person.newSize;
      
    });

    // ─── Compute Overall Population Happiness ───
    const weightedAvgIncome = popForIncome > 0 
      ? incomeSum    / popForIncome 
      : 0;

    this.PopulationHappiness  = popForTrust  > 0 
      ? trustSum     / popForTrust 
      : 0;
    console.log(`[${this.name}] Weighted Trust for Groups: ${this.PopulationHappiness.toFixed(4)}`);
    Utils.logToFile(`[${this.name}] Weighted Trust for Groups: ${this.PopulationHappiness.toFixed(4)}`);
    console.log(`[${this.name}] Weighted Average Income for Income Groups: ${weightedAvgIncome.toFixed(4)}`);
    Utils.logToFile(`[${this.name}] Weighted Average Income for Income Groups: ${weightedAvgIncome.toFixed(4)}`); 

    // ─── Log Results ───
    console.log(`[${this.name}] Population Adjustments:`);
    Utils.logToFile(`[${this.name}] Population Adjustments:`);

    popData.forEach(person => {
      console.log(`  ${person.group}: Old Trust=${person.trust.toFixed(4)}, New Trust=${person.newTrust.toFixed(4)}, Old Size=${person.size.toFixed(4)}, New Norm Size=${person.newSize.toFixed(4)}`);
      Utils.logToFile(`  ${person.group}: Old Trust=${person.trust.toFixed(4)}, New Trust=${person.newTrust.toFixed(4)}, Old Size=${person.size.toFixed(4)}, New Norm Size=${person.newSize.toFixed(4)}`);
      
      if (["Low Income", "Medium Income", "High Income"].includes(person.group)) {
        console.log(`    Old Avg Income=${person.avgIncome.toFixed(4)}, New Avg Income=${person.newAvgIncome.toFixed(4)}`);
        Utils.logToFile(`    Old Avg Income=${person.avgIncome.toFixed(4)}, New Avg Income=${person.newAvgIncome.toFixed(4)}`);
      }
    });

    console.log(`[${this.name}] Updating key metrics...`);
    Utils.logToFile(`[${this.name}] Updating key metrics...`);
    let Inflation = this.metricsData["Inflation"] || 2;
    let Unemployment = this.metricsData["Unemployment"] || 5;
    let PovertyRate = this.metricsData["Poverty Rate"] || 10;
    let previousPopulation = this.metricsData["Population"] || 0;
    let updatedPopulation = previousPopulation;
    let updatedKeyMetrics = {};
    let BaseChange = 0.02;
    let inflationEffect = (Inflation - 0.04) * 0.1;
    let taxEffect = 0.0;
    for (const metric of this.keyMetricsList) {
      let value = this.metricsData[metric] || 0;
      let updatedValue = value;
      switch (metric) {
        case "Population Happiness":
          updatedValue = this.PopulationHappiness;
          break;
        case "Inflation":
          taxEffect = 0.15 * (this.TaxRates["Agriculture"] + this.TaxRates["Retail"] + this.TaxRates["Transport"] + this.TaxRates["Electricity"]);
          let IntrestRateEffect = 0.075 * (0.03 - this.metricsData["Interest Rate"]);
          updatedValue = value * (1 + global.InflationRate + taxEffect + IntrestRateEffect + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Big Mac Index":
          updatedValue = value * (1 + Inflation);
          break;
        case "GDP":
          updatedValue = finalGDP;
          updatedKeyMetrics["GDP"] = finalGDP;
          break;
        case "Consumer Spending":
          updatedValue = value * (1 + global.ConsumerSpendingChange + (inflationEffect * 0.1) + computedGDPGrowth + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Unemployment":
          updatedValue = value * (1 + BaseChange + global.UnemploymentRate - computedGDPGrowth + Utils.getRandomNumber(-0.03, 0.02));
          break;
        case "Productivity":
          updatedValue = value * (1 + ((this.metricsData["Unemployment"] - 0.5) * 0.1) + (inflationEffect * 0.1) + global.ProductivityChange + ((this.PopulationHappiness - 0.5) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Financial Malpractice":
          updatedValue = value * (1 + BaseChange + global.FinancialMalpracticeChange + ((Inflation - computedGDPGrowth / 2) + Utils.getRandomNumber(-0.02, 0.03)));
          break;
        case "Poverty Rate":
          updatedValue = value * (1 + BaseChange + inflationEffect + global.PovertyRateChange + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Life Expectancy": {
            let happinessFactor = (this.PopulationHappiness - 0.5) * 0.1;
            let expectancyChange = 1 + BaseChange + happinessFactor + inflationEffect + Utils.getRandomNumber(-0.02, 0.03);
            updatedValue = Math.max(35.6, Math.min(130.2, value * expectancyChange));
          }
          break;
        case "Homeownership Rate": {
            taxEffect = 0.25 * (-this.TaxRates["Real Estate"]);
            let happinessImpact = (this.PopulationHappiness - 0.5) * 0.1;
            let PovertyEffect = (PovertyRate - 0.04) * 0.1;
            updatedValue = value * (1 + taxEffect + BaseChange + global.HomeownershipRateChange + PovertyEffect + inflationEffect + happinessImpact + Utils.getRandomNumber(-0.02, 0.03));
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
          taxEffect = (-this.TaxRates["Local Government Levy"] * 0.45);
          updatedValue = value * (1 + BaseChange + taxEffect + global.PrimaryEducationChange - ((PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Secondary Education":
          taxEffect = (-this.TaxRates["Local Government Levy"] * 0.45);
          updatedValue = value * (1 + BaseChange + taxEffect + global.SecondaryEducationChange - ((PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Tertiary Education":
          taxEffect = 0.25 * (-this.TaxRates["Education"]);
          updatedValue = value * (1 + BaseChange + taxEffect + global.TertiaryEducationChange - ((PovertyRate - 0.04) * 0.1) + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Government Asset Budget":
          updatedValue = finalGDP * 0.15 * 0.1  * (1.0 + Utils.getRandomNumber(-0.02, 0.03));
          break;
        case "Police Stations needed":
          updatedValue = Math.round(updatedPopulation / this.PoliceStationRatio);
          break;
        case "Power Consumer":
          updatedValue = Math.round(updatedPopulation / this.PowerGenerationRatio);
          break;
        case "Internet Towers Needed":
          updatedValue = Math.round(updatedPopulation / this.InternetTowersRatio);
          break;
        case "Communication Towers Needed":
          updatedValue = Math.round(updatedPopulation / this.CommunicationsTowersRatio);
          break;
        case "Hospitals Needed":
          updatedValue = Math.round(updatedPopulation / this.HospitalsRatio);
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
      let oldValue = this.metricsData[metric] || 0;
      let newValue = updatedKeyMetrics[metric] || 0;
      let percentageChange = ((newValue - oldValue) / (oldValue || 1)) * 100;
      let color = Math.abs(percentageChange) < 0.001 ? '\x1b[33m' :
                  Math.abs(percentageChange) >= 25 ? '\x1b[35m' :
                  percentageChange > 0 ? '\x1b[32m' : '\x1b[31m';
      const metricLogMsg = [
        `[${this.name}] Metric: ${metric}`,
        `  Old Value: ${oldValue.toFixed(4)}`,
        `  New Value: ${newValue.toFixed(4)}`,
        `  % Change: ${color}${percentageChange.toFixed(4)}%\x1b[0m`
      ].join('\n');
      
      console.log(metricLogMsg);
      Utils.logToFile(metricLogMsg);       
    }

    // SAVE REGION-SPECIFIC OUTPUT
    console.log(`[${this.name}] Saving updated data to ${this.regionOutputPath} ...`);
    Utils.logToFile(`[${this.name}] Saving updated data to ${this.regionOutputPath} ...`);
    
    // Save updated population data
    for (const pd of popData) {
      await editCsv(this.regionOutputPath, pd.group + " Trust in Government", "Data", pd.newTrust.toFixed(4));
      await editCsv(this.regionOutputPath, pd.group + " Size", "Data", pd.newSize.toFixed(4));
      console.log(`[${this.name}] Saved updated data for population group ${pd.group}`);
      if (["Low Income", "Medium Income", "High Income"].includes(pd.group)) {
        await editCsv(this.regionOutputPath, pd.group + " Avg Income", "Data", pd.newAvgIncome.toFixed(4));
        console.log(`[${this.name}] Updated Avg Income for ${pd.group}`);
      }
    }

    //Save updated economic sector data
    for (const sector of this.sectorsList) {
      let newValue = computedSectors[sector] || 0;
      await editCsv(this.regionOutputPath, sector, "Data", newValue.toFixed(4));
      console.log(`[${this.name}] Saved updated economic data for sector ${sector}`);
    }

    //Save updated key metrics data
    for (const metric in this.metricsData) {
      await editCsv(this.regionOutputPath, metric, "Data", updatedKeyMetrics[metric].toFixed(4));
      console.log(`[${this.name}] Saved updated key metric ${metric}`);
    }

    console.log(`--- Completed Processing Region: ${this.name} ---`);
    Utils.logToFile(`--- Completed Processing Region: ${this.name} ---`);
  }
}

// ─── PLANET CLASS ─────────────────────────────
// Aggregates region metrics and saves to planet CSV
class Planet {
  constructor(planetName, regionNames) {
    this.planetName = planetName;
    this.outputFilePath = FilePaths.Novum_Domitros.Data;
    this.regions = regionNames.map(rName => new Region(rName));

    // Define absolute metrics
    this.absoluteMetrics = [
      'Weights',
      'Population', 'GDP', 'Government Asset Budget',
      'Consumer Spending',
      'Office', 'Construction', 'Healthcare', 'Manufacturing', 'Real Estate',
      'Finance', 'Retail', 'Agriculture', 'Forestry', 'Fishing', 'Defence',
      'Information', 'Transport', 'Electricity', 'Water', 'Mining', 'Education',
      'Other', 'Public Service', 'Illicit', 'Colonial Holdings', 'Foreign Trade',
      'Police Stations needed', 'Power Consumer', 'Internet Towers Needed',
      'Communication Towers Needed', 'Hospitals Needed',
      'Police Stations', 'Power Produced', 'Internet Towers',
      'Communication Towers', 'Hospitals', 'Average Income'
    ];

    // Define rate metrics that require weighting
    this.rateMetrics = [
      'Liberal Size', 'Liberal Trust in Government',
      'Conservative Size', 'Conservative Trust in Government',
      'Capitalist Size', 'Capitalist Trust in Government',
      'Socialist Size', 'Socialist Trust in Government',
      'Youth Size', 'Youth Trust in Government',
      'Adult Size', 'Adult Trust in Government',
      'Seniors Size', 'Seniors Trust in Government',
      'Religious Size', 'Religious Trust in Government',
      'Non Religious Size', 'Non Religious Trust in Government',
      'Low Income Size', 'Low Income Trust in Government', 'Low Income Avg Income',
      'Medium Income Size', 'Medium Income Trust in Government', 'Medium Income Avg Income',
      'High Income Size', 'High Income Trust in Government', 'High Income Avg Income',
      'Population Happiness', 'Unemployment', 'Productivity', 'Financial Malpractice', 'Poverty Rate',
      'Life Expectancy', 'Pop Growth Rate', 'Homeownership Rate', 'Crime Rate',
      'Primary Education', 'Secondary Education', 'Tertiary Education', 'Inflation'
    ];

    // Combine all metrics
    this.metricList = this.absoluteMetrics.concat(this.rateMetrics);

    // Initialize region data entries
    this.regionEntries = [];
    regionNames.forEach(region => {
      const key = region.replace(/ /g, '_');
      const path = FilePaths.Novum_Domitros[key]?.Data;
      if (path) this.regionEntries.push({ region, path });
    });

    // Prepare storage for aggregated values and weights
    this.aggregatedData = this.metricList.map(name => ({
      name,
      total: 0.0,
      weightSum: 0.0
    }));
    
  }

  async runEndOfMonth() {
    console.log(`\n=== Processing Planet: ${this.planetName} ===`);
    Utils.logToFile(`\n=== Processing Planet: ${this.planetName} ===`);
  
    // ─── 1. Compute “before” aggregates ─────────────────────
    const before = this.aggregatedData.map(item => ({
      name: item.name,
      total: 0,
      weightSum: 0
    }));
  
    for (const entry of this.regionEntries) {
      let regionWeight = 0;
      for (const item of before) {
        const raw = await readCell(entry.path, item.name, 'Data', 2);
        const value = parseFloat(raw?.replace(/[^0-9.-]/g, '')) || 0;
        if (item.name === 'Weights') {
          regionWeight = value;
          item.weightSum += value;
        } else if (this.rateMetrics.includes(item.name)) {
          item.total += value * regionWeight;
        } else {
          item.total += value;
        }
      }
    }
  
    // ─── 2. Run all region updates ─────────────────────────
    for (const region of this.regions) {
      await region.runCalculations();
    }
  
    // ─── 3. Compute “after” aggregates ──────────────────────
    // reset your live aggregatedData counters
    this.aggregatedData.forEach(item => {
      item.total = 0;
      item.weightSum = 0;
    });
  
    for (const entry of this.regionEntries) {
      let regionWeight = 0;
      for (const item of this.aggregatedData) {
        const raw = await readCell(entry.path, item.name, 'Data', 2);
        const value = parseFloat(raw?.replace(/[^0-9.-]/g, '')) || 0;
        if (item.name === 'Weights') {
          regionWeight = value;
          item.weightSum += value;
        } else if (this.rateMetrics.includes(item.name)) {
          item.total += value * regionWeight;
        } else {
          item.total += value;
        }
      }
    }
  
    // ─── 4. Log, save & % change ────────────────────────────
    console.log(`\n=== Aggregated Metrics for Planet ${this.planetName} ===`);
    Utils.logToFile(`\n=== Aggregated Metrics for Planet ${this.planetName} ===`);
  
    for (let i = 0; i < this.aggregatedData.length; i++) {
      const name = this.aggregatedData[i].name;
      const oldVal = before[i].total;
      const newVal = this.aggregatedData[i].total;
      const pctChange = oldVal
        ? ((newVal - oldVal) / oldVal * 100).toFixed(2) + '%'
        : '—';
  
      console.log(`${name}: before=${oldVal.toFixed(4)}, after=${newVal.toFixed(4)}, change=${pctChange}`);
      Utils.logToFile(`${name}: before=${oldVal.toFixed(4)}, after=${newVal.toFixed(4)}, change=${pctChange}`);
  
      await editCsv(this.outputFilePath, name, 'Data', newVal.toFixed(4));
      console.log(`Saved ${name}`);
    }
  
    console.log(`=== Completed Processing Planet: ${this.planetName} ===`);
    Utils.logToFile(`=== Completed Processing Planet: ${this.planetName} ===`);
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
    const DebugBudget = '10LtpaLXmqkITQQ3f1VcF5BsFsiDqIaihEjfk_DkNa30';
    await downloadSheets('1xbZDUz-k_DH929kd67F22ZMOWdAC1x5aa0IzcewoJuY', "./csv_files/shared"); // Staff DB
    await downloadSheets('1jo5hThsjtMpwz03y00LO-hV3Gtl507c9alfm6_nCtxM', "csv_files/regions"); // Novum Domitros DB
    await downloadSheets(DebugBudget, "./csv_files/shared");
    
    for (const planet of this.planets) {
      await planet.runEndOfMonth();
    }
    console.log("=== Global End-of-Month Process Completed ===");
    Utils.logToFile("=== Global End-of-Month Process Completed ===");
  }
}

// const processor = new EndOfMonthProcessor();
// processor.run();
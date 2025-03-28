const { readCsv, downloadSheets } = require('./googleSheetsHandler');
const { EmbedBuilder, Guild } = require('discord.js');
const fs = require('fs');
const GUILD_ID = process.env.GUILD_ID;

const APPLICATIONS_CSV_PATH = "./csv_files/Technocratic_Registration_form_for_Parliamentary_Service_(Responses)_Form responses 1.csv";
const APPLICATIONS_CHANNEL_ID = "1351465487413936129";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes


const {AWAITING_PARTY_CHOICE, SCHOLASTICFIELDROLES, MEMBER_OF_PARLIMENT, AREAROLES, ON_PARLIAMENT_GROUNDS} = require('./roles');
// Path to the state file (CSV format)
const STATE_FILE = "./csv_files/applications_state.csv";

// Global variable to store the number of rows processed so far.
let lastRowCount = 0;

/**
 * Load the last processed row count from a CSV file.
 * The CSV is expected to have the header "lastRowCount" in the first line,
 * and the value in the second line.
 * If the file does not exist or cannot be parsed, return 0.
 */
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return 0;
  }
  try {
    const content = fs.readFileSync(STATE_FILE, "utf8").trim();
    const lines = content.split("\n");
    if (lines.length < 2) return 0;
    const value = parseInt(lines[1], 10);
    return isNaN(value) ? 0 : value;
  } catch (error) {
    console.error("Error loading state:", error);
    return 0;
  }
}

/**
 * Save the last processed row count to a CSV file.
 * The file will contain a header "lastRowCount" and the value on the second line.
 */
function saveState(lastRowCount) {
  try {
    const csvContent = "lastRowCount\n" + lastRowCount;
    fs.writeFileSync(STATE_FILE, csvContent, "utf8");
  } catch (error) {
    console.error("Error saving state:", error);
  }
}

/**
 * Build an embed message from a row object.
 * Expected row headers:
 * Timestamp, "Do you wish to proceed with your application to the Novum Domitros Parliament?",
 * "Discord Username: (As seen in server)", "Do you understand the expectations of a Member of Parliament and are you prepared to continue with your application to the Novum Domitros Parliament?",
 * "What is your full legal name as stipulated in the Official records of Novum Domitros?",
 * "What is your age as stipulated in the Official records of Novum Domitros?",
 * "What is your Sex?", "Region of birth?", "Region of Residence?",
 * "Area of specialty:", "Fields", "Tell us about your history and what brought you to this moment"
 * @param {object} row 
 */
function buildApplicationEmbed(row) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Member of Parliment");

  embed.addFields(
    //{ name: "Discord Account ID", value: row["Discord Account ID: (User ID, e.g basscleric2187)"] || "N/A" },
    { name: "Full Legal Name", value: row["What is your full legal name as stipulated in the Official records of Novum Domitros?"] || "N/A" },
    { name: "Age", value: row["What is your age as stipulated in the Official records of Novum Domitros?"] || "N/A", inline: true },
    { name: "Sex", value: row["What is your Sex?"] || "N/A", inline: true },
    { name: "Region of Birth", value: row["Region of birth?"] || "N/A" },
    { name: "Region of Residence", value: row["Region of Residence?"] || "N/A" },
    { name: "Area of Specialty", value: row["Area of specialty:"] || "N/A", inline: true },
    { name: "Fields", value: row["Fields"] || "N/A", inline: true },
    { name: "History", value: row["Tell us about your history and what brought you to this moment"] || "N/A" }
  );
  return embed;
}

/**
 * Check the applications CSV for new rows and post an embed message for each new row.
 * @param {Client} client - The Discord client instance.
 */
async function checkForNewApplications(client) {
  try {
    await downloadSheets("https://docs.google.com/spreadsheets/d/1PgMFCQTKzKBbUV1LTXXarEcTz77C9NH0LHeTLJthcNs");
    // Use readCsv to get an array of row objects.
    let rows = await readCsv(APPLICATIONS_CSV_PATH);
    rows = await readCsv(APPLICATIONS_CSV_PATH);
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
      console.log("Number of rows:", rows.length);
    } catch (error) {
      console.error("Error reading CSV:", error);
    }

    // Filter out completely empty rows.
    const validRows = rows.filter(row =>
      Object.values(row).some(val => val && val.trim() !== "")
    );
    if (!validRows || validRows.length === 0) {
      console.log("No rows found in the applications CSV.");
      return;
    }
    const totalRows = validRows.length;
    console.log(`Total rows in CSV: ${totalRows}`);
    if (totalRows > lastRowCount) {
      // New rows detected (assuming rows are appended)
      const newRows = validRows.slice(lastRowCount);
      const channel = await client.channels.fetch(APPLICATIONS_CHANNEL_ID);
      lastRowCount = totalRows;
      saveState(lastRowCount);

      for (const row of newRows) {
        const embed = buildApplicationEmbed(row);
        await channel.send({ embeds: [embed] });
        console.log(`Posted new application for ${row["Discord Account ID: (User ID, e.g basscleric2187)"] || "Unknown"}`);
        
        // Determine role to assign based on "Area of specialty:".
        const specialty = row["Area of specialty:"];
        let roleToAssign = null;
        if (specialty === "Scholastic") {
          // For Scholastic, use the "Fields" answer.
          const fieldAnswer = row["Fields"];
          if (fieldAnswer && SCHOLASTICFIELDROLES[fieldAnswer]) {
            roleToAssign = SCHOLASTICFIELDROLES[fieldAnswer];
          }
        } else if (specialty && AREAROLES[specialty]) {
          roleToAssign = AREAROLES[specialty];
        }
        
        // If a role was determined, assign it.
        if (roleToAssign) {
          try {
            const members = await guild.members.fetch();
            const usernameFromRow = row["Discord Account ID: (User ID, e.g basscleric2187)"];
            // Adjust matching as necessary (username or tag)
            const member = members.find(m => m.user.username === usernameFromRow || m.user.tag === usernameFromRow);
            if (member) {
              await member.roles.add(roleToAssign);
              await member.roles.add(MEMBER_OF_PARLIMENT);
              await member.roles.add(ON_PARLIAMENT_GROUNDS);
              await member.roles.add(AWAITING_PARTY_CHOICE);
              console.log(`Assigned role for specialty "${specialty}" (field: "${row["Fields"]}") to ${member.user.tag}`);
            }
          } catch (roleError) {
            console.error(`Error assigning role for specialty "${specialty}":`, roleError);
          }
        }
      }
    } else {
      console.log("No new applications.");
    }
  } catch (error) {
    console.error("Error checking for new applications:", error);
  }
}

/**
 * Start watching the application sheet every 15 minutes.
 * @param {Client} client - The Discord client instance.
 */
async function watchApplicationSheet(client) {
  lastRowCount = loadState();
  console.log(`Loaded last row count: ${lastRowCount}`);
  // Check immediately.
  checkForNewApplications(client);

  // Then set an interval to check every 15 minutes.
  setInterval(() => {
    checkForNewApplications(client);
  }, CHECK_INTERVAL);
}

module.exports = { watchApplicationSheet };

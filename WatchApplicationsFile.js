const { readCsv, downloadSheets } = require('./googleSheetsHandler');
const { EmbedBuilder, Guild } = require('discord.js');
const GUILD_ID = process.env.GUILD_ID;

const APPLICATIONS_CSV_PATH = "./csv_files/Technocratic_Registration_form_for_Parliamentary_Service_(Responses)_Form responses 1.csv";
const APPLICATIONS_CHANNEL_ID = "1351465487413936129";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes


const {AWAITING_PARTY_CHOICE, SCHOLASTICFIELDROLES, MEMBER_OF_PARLIMENT, AREAROLES, ON_PARLIAMENT_GROUNDS} = require('./roles');
const seenTimestamps = new Set();


function parseTimestamp(str) {
  // "31/05/2025 12:04:55"
  const [datePart, timePart] = str.split(' ');
  if (!datePart || !timePart) return null;
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
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
    .setTitle("Member of Parliament");

  embed.addFields(
    //{ name: "Discord Account ID", value: row["Discord Account ID: (User ID, e.g basscleric2187)"] || "N/A" },
    { name: "Full Legal Name", value: row["What is your full legal name as stipulated in the Official records of Novum Domitros?"] || "N/A" },
    { name: "Age", value: row["What is your age as stipulated in the Official records of Novum Domitros?"] || "N/A", inline: true },
    { name: "Sex", value: row["What is your Sex?"] || "N/A", inline: true },
    { name: "Region of Birth", value: row["Region of birth?"] || "N/A" },
    { name: "Region of Residence", value: row["Region of Residence?"] || "N/A" },
    { name: "Area of Specialty", value: row["Area of specialty:"] || "N/A", inline: true },
    { name: "Fields", value: row["Fields"] || "N/A", inline: true }
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
    let rows = await readCsv(APPLICATIONS_CSV_PATH);
    rows = await readCsv(APPLICATIONS_CSV_PATH);

    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await client.channels.fetch(APPLICATIONS_CHANNEL_ID);
    const now = new Date();


    const recentRows = rows.filter(row => {
      const timestampStr = row["Timestamp"] || Object.values(row)[0]; // fallback to first column
      if (!timestampStr) return false;

      const timestamp = parseTimestamp(timestampStr);
      const diffMinutes = (now - timestamp) / (1000 * 60);

      return !isNaN(timestamp) && diffMinutes <= 14;
    });


    if (recentRows.length === 0) {
      console.log("No new applications in the last 14 minutes.");
      return;
    }

    for (const row of recentRows) {
      const timestampStr = row["Timestamp"] || Object.values(row)[0];
      if (!timestampStr || seenTimestamps.has(timestampStr)) {
        continue;
      }

      const timestamp = parseTimestamp(timestampStr); 
      const now = new Date();
      const diffMinutes = ((now - timestamp) / (1000 * 60)).toFixed(2);
      const userId = row["Discord Account ID: (User ID, e.g basscleric2187)"] || "Unknown ID";
      console.log(`User ID: ${userId} | Posted: ${diffMinutes} minutes ago`);

      const embed = buildApplicationEmbed(row);
      await channel.send({ embeds: [embed] });
      seenTimestamps.add(timestampStr);
      console.log(`Posted new application for ${row["Discord Account ID: (User ID, e.g basscleric2187)"] || "Unknown"}`);


      const specialty = row["Area of specialty:"];
      let roleToAssign = null;

      if (specialty === "Scholastic") {
        const fieldAnswer = row["Fields"];
        if (fieldAnswer && SCHOLASTICFIELDROLES[fieldAnswer]) {
          roleToAssign = SCHOLASTICFIELDROLES[fieldAnswer];
        }
      } else if (specialty && AREAROLES[specialty]) {
        roleToAssign = AREAROLES[specialty];
      }

      if (roleToAssign) {
        try {
          const members = await guild.members.fetch();
          const usernameFromRow = row["Discord Account ID: (User ID, e.g basscleric2187)"];
          const member = members.find(m => m.user.username === usernameFromRow || m.user.tag === usernameFromRow);

          if (member) {
            await member.roles.add(roleToAssign);
            await member.roles.add(MEMBER_OF_PARLIMENT);
            await member.roles.add(ON_PARLIAMENT_GROUNDS);
            await member.roles.add(AWAITING_PARTY_CHOICE);
            console.log(`Assigned role for ${member.user.tag}`);
          } else {
            const lookupFailedChannel = await client.channels.fetch("1093061364219662346");
            await lookupFailedChannel.send(`User {Discord Account ID: ${usernameFromRow}} lookup failed. Manual role assignment needed.`);
          }
        } catch (roleError) {
          console.error(`Error assigning role for specialty "${specialty}":`, roleError);
        }
      }
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
  console.log("Starting application watcher...");
  await checkForNewApplications(client); // Check immediately
  setInterval(() => checkForNewApplications(client), CHECK_INTERVAL); // Every 15 minutes
}

module.exports = { watchApplicationSheet };

/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
//
// Discord: 
/////////////////////////////////////////////////////////////////

// Add required libraries
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Discord Setup
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const VERSION_ID = '1.0.0';

// Google Sheets Setup
const { google } = require("googleapis");
const credentials = JSON.parse(fs.readFileSync("service-account.json", "utf8"));
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_IDS = process.env.SHEET_IDS.split(",");

// Constants
const LOG_CHANNEL_ID = '1105379725100187732';
const ROLE_ID = '1289810234826821674';
const VOICE_CHANNEL_ID = '1339050143218929674';
const MOVE_TIME = 0.5 * 60 * 1000; // 30s

// Register slash commands with Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);

// File Imports
const {commands} = require('./commands');
const {SecureLocations, PossibleLocations} = require('./Locations');
const {SERVER_DIRECTOR, MEMBER_OF_PARLIMENT, ALLOWED_ROLES, ON_PARLIAMENT_GROUNDS} = require('./roles');
const {readCSV, saveToCSV} = require('./Functions/CSV');
const {USERS_CSV_PATH, getUserLocation, setUserLocation} = require('./Functions/UserLocation');
const {executeTimer, scheduleTimer, saveTimers, loadTimers} = require('./Functions/timers');
const {testGoogleSheetsConnection, downloadSheets, editCsv, uploadCsv} = require('./googleSheetsHandler');
const {RunEndofMonth} = require('./EndOfMonth');
const { watchApplicationSheet } = require('./WatchApplicationsFile');

(async () => {
    try {
        console.log('Started Reloading Application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Successfully Reloaded Application (/) commands.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
})();

// Event: Bot is ready
client.once('ready', () => {
    console.log(`Starhawk is online! Logged in as ${client.user.tag}`);
    fetchUsersWithRole();
});

// Function to update the voice channel name with the number of "Contractor" members
async function updateVoiceChannel() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const voiceChannel = await guild.channels.fetch(VOICE_CHANNEL_ID);

        // Get all members in the guild
        const members = await guild.members.fetch();

        // Count the number of members with the "Contractor" role
        const MPCount = members.filter(member => member.roles.cache.has(MEMBER_OF_PARLIMENT)).size;

        // Update the voice channel name
        await voiceChannel.setName(`Members of Parliment: ${MPCount}`);
    } catch (error) {
        console.error('Error updating voice channel name:', error);
    }
}

// Update every 5 minutes
setInterval(updateVoiceChannel, 5 * 60 * 1000); // 5 minutes

// Log command usage and conditions
async function logCommandUsage(commandName, user, conditions) {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID); 
    console.log(`Command: /${commandName} used by ${user.displayName} with conditions: ${conditions}`);
    await logChannel.send(`Command: /${commandName} used by ${user} with conditions: ${conditions}`);
}

async function fetchUsersWithRole() {
    try {
        // Ensure the CSV file exists with the proper header
        if (!fs.existsSync(USERS_CSV_PATH)) {
            fs.writeFileSync(USERS_CSV_PATH, "userId,username,location\n", { flag: "w" });
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.members.fetch(); // Fetch all members

        const role = guild.roles.cache.get(ROLE_ID);
        if (!role) {
            console.error("Role not found.");
            return;
        }

        // Log fetched members for debugging
        role.members.forEach(member => {
            console.log(`Fetched Member: ${member.user.username} | ID: ${member.user.id}`);
        });

        // Read existing users from CSV and filter out empty rows
        let existingUsers = await readCSV();
        existingUsers = existingUsers.filter(user => user.userId && user.userId.trim() !== "");

        // Create a set of existing user IDs
        const existingUserIds = new Set(existingUsers.map(user => user.userId));

        // Filter only new users (those not already in the CSV)
        const newUsers = role.members
            .filter(member => !existingUserIds.has(member.user.id))
            .map(member => ({
                userId: member.user.id,
                username: member.user.username,
                location: PossibleLocations[0]
            }));

        if (newUsers.length > 0) {
            console.log(`Adding ${newUsers.length} new users.`);
            saveToCSV([...existingUsers, ...newUsers]);
        } else {
            console.log("No new users to add.");
        }
    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
  
    const { commandName, options, user } = interaction;
    // Get the member object for the user who invoked the command
    const member = await interaction.guild.members.fetch(interaction.member);
  
    // refresh_channel command
    if (commandName === 'refresh_channel') {
      if (!member.roles.cache.some(role => role.id === SERVER_DIRECTOR)) {
        return interaction.reply("You don't have permission to use this command.");
      }
      try {
        await updateVoiceChannel();
        await interaction.reply('Voice channel name refreshed.');
        logCommandUsage(commandName, member, 'Manual refresh of voice channel name');
      } catch (error) {
        console.error('Command refresh_channel Failed:', error);
      }
    }
  
    // check_mp_location command
    if (commandName === 'check_mp_location') {
      // Use the provided user (option named "mp") or default to the invoking user
      const targetUser = options.getUser("mp") || user;
      try {
        const location = await getUserLocation(targetUser.id);
        const displayLocation = location || "Unknown";
        await interaction.reply(`${targetUser.username}'s current location is: **${displayLocation}**`);
        logCommandUsage(commandName, member, `Checked location for ${targetUser.username}`);
      } catch (error) {
        console.error("Error checking location:", error);
        await interaction.reply("There was an error retrieving the location.");
      }
    }
  
    // travel_to_location command (formerly movelocation)
    if (commandName === 'travel_to_location') {
      // Since the command doesn't include a target user option, default to the invoking user
      const targetUser = user;
      const targetMember = await interaction.guild.members.fetch(user.id);
      const newLocation = options.getString("travel_location");
  
      if (!member.roles.cache.some(role => role.id === SERVER_DIRECTOR)) {
        return interaction.reply("You don't have permission to use this command.");
      }
  
      if (!PossibleLocations.includes(newLocation)) {
        await interaction.reply(`Invalid location. Choose from: ${PossibleLocations.join(", ")}`);
        return;
      }
  
      // Immediately remove the ON_PARLIAMENT_GROUNDS role if moving away from it.
      if (newLocation !== PossibleLocations[0]) {
        await targetMember.roles.remove(ON_PARLIAMENT_GROUNDS);
      }
  
      try {
        await interaction.reply(`Moving **${targetUser.username}** to **${newLocation}** in ${MOVE_TIME / 1000} seconds...`);
        logCommandUsage(commandName, member, `Scheduled move to ${newLocation}`);
  
        setTimeout(async () => {
          try {
            await setUserLocation(targetUser.id, targetUser.username, newLocation);
            console.log(`${targetUser.username} has moved to: ${newLocation}`);
            logCommandUsage(commandName, member, `Moved to ${newLocation}`);
  
            // Only add the role if the user arrives at ON_PARLIAMENT_GROUNDS
            if (newLocation === PossibleLocations[0]) {
              await targetMember.roles.add(ON_PARLIAMENT_GROUNDS);
            }
            await interaction.followUp(`${targetUser.username} has arrived at **${newLocation}**.`);
          } catch (error) {
            console.error("Error updating location after delay:", error);
          }
        }, MOVE_TIME);
      } catch (error) {
        console.error("Error initiating travel_to_location:", error);
        await interaction.reply("There was an error scheduling your location update.");
      }
    }
  
    // test_bot command
    if (commandName === 'test_bot') {
      if (!member.roles.cache.some(role => role.id === SERVER_DIRECTOR)) {
        return interaction.reply("You don't have permission to use this command.");
      }
      try {
        await interaction.reply('testing 123');
        logCommandUsage(commandName, member, 'No specific conditions');
      } catch (error) {
        console.error('Command test_bot Failed:', error);
      }
    }
  
    // bot_stats command
    if (commandName === 'bot_stats') {
      try {
        const uptime = process.uptime(); // Bot uptime in seconds
        const days = Math.floor(uptime / (24 * 60 * 60));
        const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((uptime % (60 * 60)) / 60);
        const seconds = Math.floor(uptime % 60);
  
        await interaction.reply(`Version ${VERSION_ID}, Bot Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`);
        logCommandUsage(commandName, member, 'Bot uptime requested');
      } catch (error) {
        console.error('Command bot_stats Failed:', error);
      }
    }
  
    // run_end_of_month command
    if (commandName === 'run_end_of_month') {
      if (!member.roles.cache.some(role => role.id === SERVER_DIRECTOR)) {
        return interaction.reply("You don't have permission to use this command.");
      }
      try {
        await interaction.reply(`Running End of Month`);
        await downloadSheets(SPREADSHEET_IDS);
        await downloadSheets(options.getString("budget_link"));
        await RunEndofMonth();
        logCommandUsage(commandName, member, 'Running End of Month');
      } catch (error) {
        console.error('Command run_end_of_month Failed:', error);
      }
    }
  
    // add_bill_for_oversight_committee command
    if (commandName === 'add_bill_for_oversight_committee') {
        if (!member.roles.cache.some(role => role.id === SERVER_DIRECTOR)) {
          return interaction.reply("You don't have permission to use this command.");
        }
        const billLink = options.getString('bill_link');
        const bill_name = options.getString('bill_name');
        
        try {
        const dateObj = new Date();
        const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
                            ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
                            dateObj.getFullYear();            
      
          // The append method automatically adds data to the next available row in the specified range.
          const request = {
            spreadsheetId: '1xMv0ndSax-IukyL0N5qKbVkUCF2ArhCaehvP2Jh7ewY',
            range: 'Bills!A:C',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [
                [bill_name, billLink, currentDate]
              ]
            }
          };
      
          await sheets.spreadsheets.values.append(request);
          await interaction.reply(`Bill added for Oversight Committee: ${billLink}`);
          logCommandUsage(commandName, member, `Added bill for Oversight Committee: ${billLink}`);
        } catch (error) {
          console.error('Command add_bill_for_oversight_committee Failed:', error);
          await interaction.reply("There was an error adding the bill.");
          // 1289816803341504625 - Oversight chat
        }
      }
      

    if (commandName === 'add_event_to_end_of_month') {
        if (!member.roles.cache.some(role => role.id === SERVER_DIRECTOR)) {
          return interaction.reply("You don't have permission to use this command.");
        }
        const event_name = options.getString('event_name');
        
        try {
        const dateObj = new Date();
        const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
                            ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
                            dateObj.getFullYear();            
      
          // The append method automatically adds data to the next available row in the specified range.
          const request = {
            spreadsheetId: '1xMv0ndSax-IukyL0N5qKbVkUCF2ArhCaehvP2Jh7ewY',
            range: 'Events!A:B',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [
                [event_name, currentDate]
              ]
            }
          };

          await sheets.spreadsheets.values.append(request);
          
          await interaction.reply(`Event added for End of Month: ${event_name}`);
          logCommandUsage(commandName, member, `Event added for End of Month: ${event_name}`);
        } catch (error) {
          console.error('Command add_event_to_end_of_month Failed:', error);
        }
      }
  
    // new_bill command
    if (commandName === 'new_bill') {
    const billLink = options.getString('bill_link');
    const bill_name = options.getString('bill_name');
      try {
        const dateObj = new Date();
        const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
                            ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
                            dateObj.getFullYear();            
      
          // The append method automatically adds data to the next available row in the specified range.
          const request = {
            spreadsheetId: '1eqvvVo5-uS1SU8dGaRy3tvGEB7zHjZp53whQUU5CVRI',
            range: 'Queue!A:D',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [
                [bill_name, billLink, member.displayName, currentDate]
              ]
            }
          };

          await sheets.spreadsheets.values.append(request);

        // Add logic to add the bill to the regular queue here.
        await interaction.reply(`New bill added: ${billLink}`);
        logCommandUsage(commandName, member, `New bill added: ${billLink}`);
      } catch (error) {
        console.error('Command new_bill Failed:', error);
      }
    }
  
    // use_specialisation command
    if (commandName === 'use_specialisation') {
      try {
        // Add logic for using specialisation at the current location here.
        await interaction.reply("Specialisation used at your current location.");
        logCommandUsage(commandName, member, 'Used specialisation');
      } catch (error) {
        console.error('Command use_specialisation Failed:', error);
      }
    }
  }); 


// Log in to Discord
try {
    client.login(TOKEN);
} catch (error) {
    console.log('Failed to Login to discord');
}

// Startup functions
async function startup() {
    await loadTimers();
    await downloadSheets(SPREADSHEET_IDS);
    await downloadSheets("https://docs.google.com/spreadsheets/d/18XqkHD2uvQQz1tPSaPC6j5hCic5rr3aYTlr3w0tZL_E/edit?usp=drive_web&ouid=101879698021059588040");
    await RunEndofMonth();
    await watchApplicationSheet(client);
}

startup();

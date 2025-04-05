/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
//
// Discord: 
/////////////////////////////////////////////////////////////////

// Add required libraries
require('dotenv').config();
const {EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ApplicationCommandOptionType, Client, GatewayIntentBits, REST, Routes, Guild } = require('discord.js');
const fs = require('fs');

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
const MOVE_TIME = 8 * 60 * 60 * 1000; 
const MapURL = 'https://ascendancydevlopers.github.io/Ascendancy-Maps/#19/-0.00115/0.03629';

// Register slash commands with Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);

const travelingUsers = new Set();

// File Imports
const {commands} = require('./commands');
const {SecureLocations, PossibleLocations} = require('./Locations');
const {MEMBER_OF_PARLIMENT,
  SERVER_DIRECTOR,
  LEADER_OF_THE_HOUSE,
  ON_PARLIAMENT_GROUNDS,
  CABINETROLES,
  PRIME_MINISTER,
  CABINET_MEMBER,
  RESERVE_BANK_GOV} = require('./roles');
const {readCSV, saveToCSV} = require('./CSV');
const {getAllUserLocations, USERS_CSV_PATH, getUserLocation, setUserLocation} = require('./UserLocation');
const {scheduleTimer} = require('./timers');
const {downloadSheets, editCsv, uploadCsv, readCsv, readCell} = require('./googleSheetsHandler');
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

// Function to create a delay using Promise and async/await
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function SetupBillQueue() {
  const filePath = './csv_files/Bill_Queue_Queue.csv';
  const data = await readCsv(filePath);

  // Extract values from Column A (First Column)
  const columnAValues = data.map(row => row[Object.keys(data[0])[0]]);
  
  // Set BillsInQueue to the extracted values
  BillsInQueue = columnAValues;
  console.log('Bills In Queue:', BillsInQueue);

  try {
    // Fetch current guild commands
    const fetchedCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
    console.log('Registered Commands:', fetchedCommands.map(cmd => cmd.name)); // Debug log

    // Find the /create-vote command (ensure the name matches exactly)
    const createVoteCommand = fetchedCommands.find(cmd => cmd.name === 'create-vote');
    
    if (!createVoteCommand) {
      console.log('Command /create-vote not found.');
      return;
    }

    // Update the first option's choices for the /create-vote command
    // (Assuming the first option is the one you want to update)
    createVoteCommand.options[0].choices = BillsInQueue.map(bill => ({
      name: bill,
      value: bill
    }));

    // Send the updated command back to Discord
    await rest.patch(Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, createVoteCommand.id), {
      body: createVoteCommand
    });

    console.log('Command /create-vote updated successfully!');
  } catch (error) {
    console.error('Error updating /create-vote command:', error);
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
                location: PossibleLocations[0].name
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

    if (commandName === "create-vote") {
      try {
        const filePath = './csv_files/Bill_Queue_Queue.csv';
        // Check if the user has the 'MEMBER_OF_PARLIAMENT' role
        if (!member.roles.cache.some(role => role.id === LEADER_OF_THE_HOUSE)) {
            return interaction.reply("You don't have permission to use this command.");
        }

        // Get the bill name and link from the queue using readCell (replace with the correct logic to get the bill data)
        const billName = interaction.options.getString('bill');
        const billLink = await readCell(filePath, billName, 'Link to Bill'); // Replace with your logic to fetch the link from the queue
        console.log(billLink);

        // Create the embed for the vote
        const voteEmbed = new EmbedBuilder()
            .setTitle(`Vote on Bill: ${billName}`)
            .setDescription(`Click below to vote on the bill. ✅ to vote Yes, ❌ to vote No.`)
            .addFields(
                { name: "Bill Name", value: billName, inline: false },
                { name: "Bill Link", value: billLink, inline: false }
            )
            .setColor(0x0099ff)
            .setTimestamp(new Date());

        // Send the embed to the specified channel (1352558511376306226)
        const channel = await interaction.client.channels.fetch('1352558511376306226');
        const voteMessage = await channel.send({ embeds: [voteEmbed] });

        // Add reactions to the message for voting
        await voteMessage.react('❌');
        await voteMessage.react('✅');

        // Schedule a function to count reactions after 24 hours
        setTimeout(async () => {
            const message = await channel.messages.fetch(voteMessage.id);
          
            // Ensure reactions are fully cached
            await message.fetch();
    
            // Get the count of reactions for each emoji
            const upvoteReaction = message.reactions.cache.get('✅');
            const downvoteReaction = message.reactions.cache.get('❌');
    
            // Safely access the count or set to 0 if undefined
            const upvoteCount = upvoteReaction ? upvoteReaction.count : 0;
            const downvoteCount = downvoteReaction ? downvoteReaction.count : 0;

            // Create the result embed
            const resultEmbed = new EmbedBuilder()
                .setTitle(`Voting Results for Bill: ${billName}`)
                .addFields(
                    { name: "Yes Votes", value: `${upvoteCount - 1}`, inline: true }, // Subtracting 1 for the initial reaction
                    { name: "No Votes", value: `${downvoteCount - 1}`, inline: true },
                    { name: "Bill Outcome", value: upvoteCount > downvoteCount ? "Bill Passed" : "Bill Failed", inline: false }
                )
                .setColor(upvoteCount > downvoteCount ? 0x00ff00 : 0xff0000)
                .setTimestamp(new Date());

            // Send the result embed to the results channel
            const resultsChannel = await interaction.client.channels.fetch('1352555058210013194');
            await resultsChannel.send({ embeds: [resultEmbed] });
            message.delete()
        }, 24 * 60 * 60 * 1000);

        await interaction.reply(`Voting for the bill "${billName}" has been initiated.`);
      } catch (error) {
        console.error("Error checking location:", error);
        await interaction.reply("There was an error.");
      }
    }

    if (commandName === "check-mp-location") {
      const targetUser = options.getUser("mp");
      try {
        if (targetUser) {
          // Fetch individual MP's location
          const location = await getUserLocation(targetUser.id);
          const displayLocation = location || "Unknown";
    
          // Find location data for the embed image (if applicable)
          const locationData = PossibleLocations.find(loc => loc.name === displayLocation);
    
          const userEmbed = new EmbedBuilder()
            .setTitle("MP Location Check")
            .setDescription(`**${targetUser.username}** is currently at **${displayLocation}**.`)
            .setColor(0x0099ff)
            .setTimestamp(new Date());
    
          // Add image if a valid location is found
          if (locationData) {
            userEmbed.setImage(locationData.url);
            userEmbed.setURL(MapURL)
          }
    
          await interaction.reply({ embeds: [userEmbed] });
          logCommandUsage(commandName, member, `Checked location for ${targetUser.username}`);
        } else {
          // Get all MPs and their locations as an array of { userId, username, location }
          const mpLocationsArray = await getAllUserLocations();
    
          // Map user IDs to their display names
          const locationMap = {};
          for (const mp of mpLocationsArray) {
            const loc = mp.location || "Unknown";
            
            // Fetch member from the Discord server
            const member = await interaction.guild.members.fetch(mp.userId).catch(() => null);
            const displayName = member ? member.displayName : mp.username;

            if (!locationMap[loc]) {
              locationMap[loc] = [];
            }
            locationMap[loc].push(displayName);
          }

          // Create embed fields from the grouped data
          const locationFields = Object.entries(locationMap).map(([location, users]) => ({
            name: `📍 ${location}`,
            value: users.join(", "),
            inline: false,
          }));
    
          if (locationFields.length === 0) {
            await interaction.reply("No MPs currently have a recorded location.");
            return;
          }
    
          const locationEmbed = new EmbedBuilder()
            .setTitle("MPs by Location")
            .setDescription("Here is a list of all MPs and where they are currently located.")
            .addFields(locationFields)
            .setColor(0x00ff00)
            .setTimestamp(new Date());
    
          await interaction.reply({ embeds: [locationEmbed] });
          logCommandUsage(commandName, member, "Checked all MP locations");
        }
      } catch (error) {
        console.error("Error checking location:", error);
        await interaction.reply("There was an error retrieving the location.");
      }
    }    
  
    if (commandName === "travel-to-location") {
      const targetUser = user;
      const targetMember = await interaction.guild.members.fetch(user.id);
      const newLocation = options.getString("travel_location");
  
      if (!member.roles.cache.some((role) => role.id === MEMBER_OF_PARLIMENT)) {
          return interaction.reply("You don't have permission to use this command.");
      }
  
      // Check if user is already traveling (using a global Set travelingUsers)
      if (travelingUsers.has(targetUser.id)) {
          return interaction.reply("You are already traveling!");
      }
  
      // Check if the user is already at the new location
      const currentLocation = await getUserLocation(targetUser.id);
      if (currentLocation === newLocation) {
          return interaction.reply("You are already at that location.");
      }
  
      // Find location object from PossibleLocations
      const locationData = PossibleLocations.find(loc => loc.name === newLocation);
      if (!locationData) {
          await interaction.reply(
              `Invalid location. Choose from: ${PossibleLocations.map(loc => loc.name).join(", ")}`
          );
          return;
      }
  
      // Immediately remove ON_PARLIAMENT_GROUNDS role if moving away
      if (newLocation !== "Government Grounds") {
          await targetMember.roles.remove(ON_PARLIAMENT_GROUNDS);
      }
  
      // Travel embed
      const travelEmbed = new EmbedBuilder()
          .setTitle(`Traveling to ${newLocation}`)
          .setDescription(
              `${targetMember.displayName} is traveling to **${newLocation}**.\nEstimated travel time: **8 hrs**.`
          )
          .setImage(locationData.url)
          .setURL(MapURL)
          .setColor(0x0099ff);
  
      await interaction.reply({ embeds: [travelEmbed] });
      logCommandUsage(commandName, member, `Scheduled move to ${newLocation}`);
  
      // Mark user as traveling
      travelingUsers.add(targetUser.id);
  
      // Schedule timer for travel completion
      scheduleTimer(
          `travel_${targetUser.id}`,
          new Date(Date.now() + MOVE_TIME),
          async () => {
              try {
                  await setUserLocation(targetUser.id, targetUser.username, newLocation);
                  console.log(`${targetUser.username} has moved to: ${newLocation}`);
                  logCommandUsage(commandName, member, `Moved to ${newLocation}`);
  
                  // Assign or remove ON_PARLIAMENT_GROUNDS role
                  if (newLocation === "Government Grounds") {
                      await targetMember.roles.add(ON_PARLIAMENT_GROUNDS);
                  } else {
                      await targetMember.roles.remove(ON_PARLIAMENT_GROUNDS);
                  }
  
                  // Arrival embed
                  const arrivalEmbed = new EmbedBuilder()
                      .setTitle(`${targetMember.displayName} has arrived!`)
                      .setDescription(`Welcome to **${newLocation}**!`)
                      .setImage(locationData.url)
                      .setURL(MapURL)
                      .setColor(0x00ff00);
  
                  await interaction.followUp({ embeds: [arrivalEmbed] });
              } catch (error) {
                  console.error("Error updating location after delay:", error);
              } finally {
                  // Remove user from traveling set regardless of success or failure
                  travelingUsers.delete(targetUser.id);
              }
          }
      );
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
    if (commandName === 'bot-stats') {
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
    if (commandName === 'run-end-of-month') {
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
  
    if (commandName === 'add-bill-for-oversight-council') {
      if (!member.roles.cache.some(role => role.id === LEADER_OF_THE_HOUSE)) {
        return interaction.reply("You don't have permission to use this command.");
      }
      
      const billLink = options.getString('bill_link');
      const bill_name = options.getString('bill_name');
    
      try {
        // Get current date
        const dateObj = new Date();
        const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
                            ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
                            dateObj.getFullYear();
      
        // 1. Fetch the existing bills and find the row to delete
        const request = {
          spreadsheetId: '1eqvvVo5-uS1SU8dGaRy3tvGEB7zHjZp53whQUU5CVRI',
          range: 'Queue!A:A', // Get only the first column (Bill names)
        };
      
        const response = await sheets.spreadsheets.values.get(request);
        const rows = response.data.values; // Rows in column A
        let rowIndexToDelete = -1;
      
        // Find the row with the matching bill name
        if (rows) {
          rowIndexToDelete = rows.findIndex(row => row[0] === bill_name);
        }
      
        if (rowIndexToDelete !== -1) {
          // Row found, delete it
          const deleteRequest = {
            spreadsheetId: '1eqvvVo5-uS1SU8dGaRy3tvGEB7zHjZp53whQUU5CVRI',
            range: `Queue!A${rowIndexToDelete + 1}:D${rowIndexToDelete + 1}`,
          };
          await sheets.spreadsheets.values.clear(deleteRequest); // This will clear the values of the row
          console.log(`Row ${rowIndexToDelete + 1} deleted from Bills sheet.`);
        }
    
        // 2. Append the new bill information
        const appendRequest = {
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
        
        await sheets.spreadsheets.values.append(appendRequest);
    
        // Reply to the interaction
        await interaction.reply(`Bill added for Oversight Committee: ${billLink}`);
        logCommandUsage(commandName, member, `Added bill for Oversight Committee: ${billLink}`);
    
        // 3. Create and send the embed in the specified channel (1289816803341504625)
        const embed = new EmbedBuilder()
          .setTitle("Bill Passed by Parliament")
          .addFields(
            { name: "Bill Name", value: bill_name, inline: false },
            { name: "Bill Link", value: billLink, inline: false }
          )
          .setColor(0x00FF00)  // Green for passed bills
          .setTimestamp(new Date());
    
        const channel = await interaction.client.channels.fetch('1289816803341504625');
        await channel.send({ embeds: [embed] });
    
      } catch (error) {
        console.error('Command add_bill_for_oversight_committee Failed:', error);
        await interaction.reply("There was an error adding the bill.");
      }
    }

    if (commandName === 'add-event-to-end-of-month') {
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
    if (commandName === 'new-bill') {
      if (!member.roles.cache.some(role => role.id === MEMBER_OF_PARLIMENT)) {
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

          // Create the embed to notify the channel
          const billEmbed = new EmbedBuilder()
              .setTitle("New Bill Added to Queue")
              .setDescription(`${bill_name} added to the queue by **${member.displayName}**`)
              .addFields(
                  { name: "Link", value: billLink, inline: false },
                  { name: "Date", value: currentDate, inline: false }
              )
              .setColor(0x0099ff);

          // Send the embed to the specified channel
          const channel = await interaction.client.channels.fetch('1352555058210013194');
          await channel.send({ embeds: [billEmbed] });

          // Respond to the user
          await interaction.reply(`New bill added: ${billLink}`);

          await downloadSheets('1eqvvVo5-uS1SU8dGaRy3tvGEB7zHjZp53whQUU5CVRI');
          await delay(250)
          await SetupBillQueue();

          logCommandUsage(commandName, member, `New bill added: ${billLink}`);
      } catch (error) {
          console.error('Command new_bill Failed:', error);
      }
    }
  
    // use_specialisation command
    if (commandName === 'use-specialisation') {
      if (!member.roles.cache.some(role => role.id === MEMBER_OF_PARLIMENT)) {
        return interaction.reply("You don't have permission to use this command.");
      }
      try {
        const action = options.getString('action');
        const dateObj = new Date();
        const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
                            ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
                            dateObj.getFullYear();
    
        // Append event to Google Sheets
        const request = {
          spreadsheetId: '1xMv0ndSax-IukyL0N5qKbVkUCF2ArhCaehvP2Jh7ewY',
          range: 'Events!A:B',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [
              [action, currentDate]
            ]
          }
        };
        await sheets.spreadsheets.values.append(request);
    
        // Determine the user's current location.
        const userLocationName = await getUserLocation(member.id);
        console.log(userLocationName);
        const locationObj = PossibleLocations.find(loc => loc.name === userLocationName);
        const locationImageUrl = locationObj ? locationObj.url : null;
    
        // Create an embed that includes the user's global name, current location, and the action in full.
        const embed = new EmbedBuilder()
          .setTitle("Action Taken")
          .setDescription(`${member.user.displayName} Has taken a action at **${userLocationName}**\n\n**Action:** ${action}`)
          .setTimestamp(dateObj)
          .setColor(0xFCA000);
    
        if (locationImageUrl) {
          embed.setImage(locationImageUrl);
          embed.setURL(MapURL);
        }
    
        // Send the embed to the channel
        await interaction.reply({ embeds: [embed] });
        
        logCommandUsage(commandName, member, 'Used specialisation');
      } catch (error) {
        console.error('Command use_specialisation Failed:', error);
      }
    }

    // Assuming the command execution is handled in the following way
    if (commandName === 'change-cabinet-member') {
      if (!member.roles.cache.some(role => role.id === PRIME_MINISTER)) {
        return interaction.reply("You don't have permission to use this command.");
      }

      const mp = options.getUser('mp');
      const action = options.getString('action');
      const roleName = options.getString('role');
      const roleId = CABINETROLES[roleName];

      if (!roleId) {
        return interaction.reply("Invalid role selected.");
      }

      try {
        const memberToUpdate = await interaction.guild.members.fetch(mp.id);
        if (action === 'add') {
          await memberToUpdate.roles.add(roleId);
          await interaction.reply(`${mp.username} has been added to the cabinet as ${roleName}.`);
        } else if (action === 'remove') {
          await memberToUpdate.roles.remove(roleId);
          await interaction.reply(`${mp.username} has been removed from the cabinet position of ${roleName}.`);
        } else {
          await interaction.reply("Invalid action. Please choose either 'add' or 'remove'.");
        }

        // Check if the member has any of the cabinet roles
        const hasCabinetRole = memberToUpdate.roles.cache.some(role => Object.values(CABINETROLES).includes(role.id));

        // If the member has any of the cabinet roles, add CABINET_MEMBER
        if (hasCabinetRole) {
          await memberToUpdate.roles.add(CABINET_MEMBER);
          console.log(`${mp} is now assigned the CABINET_MEMBER role.`);
        }

      } catch (error) {
        console.error('Error in change-cabinet-member command:', error);
        await interaction.reply("There was an error processing your request.");
      }
    }

    if (commandName == 'adjust-the-interest-rate')
    {
      if (!member.roles.cache.some(role => role.id === RESERVE_BANK_GOV)) {
        return interaction.reply("You don't have permission to use this command.");
      }
      let new_rate = options.getNumber('new_rate');
      new_rate = new_rate / 100;


      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_IDS,
          range: `MetricsData!B7`,
          valueInputOption: "RAW",
          requestBody: {
            values: [[new_rate]] 
          }
        });

        const new_rate_label = `${new_rate*100}%`;

        const action = `Intrest Rate updated to ${new_rate_label}`;
        const dateObj = new Date();
        const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
                            ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
                            dateObj.getFullYear();
    
        // Append event to Google Sheets
        const request = {
          spreadsheetId: '1xMv0ndSax-IukyL0N5qKbVkUCF2ArhCaehvP2Jh7ewY',
          range: 'Events!A:B',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [
              [action, currentDate]
            ]
          }
        };

        await sheets.spreadsheets.values.append(request);
        
        console.log(`Intrest Rate Adjusted\nNew Rate: ${new_rate_label}`)
        return interaction.reply(`Intrest Rate Adjusted\nNew Rate: ${new_rate_label}`);

      } catch (error) {
        console.error('Error in Adjusting the intrest rate command:', error);
        await interaction.reply("There was an error processing your request.");
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
  await downloadSheets('1eqvvVo5-uS1SU8dGaRy3tvGEB7zHjZp53whQUU5CVRI');
  console.log(await getAllUserLocations());
  await SetupBillQueue();
  await watchApplicationSheet(client);
}

startup();
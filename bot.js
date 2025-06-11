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
const VERSION_ID = '1.1.4';

// Google Sheets Setup
const { google } = require("googleapis");
const credentials = JSON.parse(fs.readFileSync("service-account.json", "utf8"));
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_IDS = process.env.SHEET_IDS.split(",");

// Constants
const LOG_CHANNEL_ID = '1105379725100187732';
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
  RESERVE_BANK_GOV,
  OVERSIGHT_COUNCIL_CHAIR,
  PRODCEDUAL_CLERK
} = require('./roles');
const {startupUserLocations, getAllUserLocations, getUserLocation, setUserLocation} = require('./UserLocation');
const {scheduleTimer} = require('./timers');
const {downloadSheets, readCsv, readCell} = require('./googleSheetsHandler');
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
});

// Function to create a delay using Promise and async/await
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Log command usage and conditions
async function logCommandUsage(commandName, user, conditions) {
    const logChannel = await client.channels.fetch(LOG_CHANNEL_ID); 
    console.log(`Command: /${commandName} used by ${user.displayName} with conditions: ${conditions}`);
    await logChannel.send(`Command: /${commandName} used by ${user} with conditions: ${conditions}`);
}

async function fetchAllMPs() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.members.fetch(); // Fetch all members

        const role = guild.roles.cache.get(MEMBER_OF_PARLIMENT);
        if (!role) {
            console.error("Role not found.");
            return;
        }

        // Log fetched members for debugging
        role.members.forEach(member => {
            console.log(`Fetched Member: ${member.user.username} | ID: ${member.user.id}`);
        });

        // Filter only new users
        const newUsers = role.members
            .map(member => ({
                id: member.user.id,
                username: member.user.username
            }));

        if (newUsers.length > 0) {
            console.log(`Adding ${newUsers.length} new users.`);
            return newUsers;
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
  if (commandName === 'refresh-voice-channel') {
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

  if (commandName === "check-mp-location") {
    const targetUser = options.getUser("mp");
    try {
      if (targetUser) {
        // Fetch individual MP's location
        const location = await getUserLocation(targetUser.id);
        const displayLocation = PossibleLocations.find(loc => loc.name === location)?.name || "Unknown";

  
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
        const mpLocationsArray = await getAllUserLocations();

        const locationMap = {};
        for (const mp of mpLocationsArray) {
          const loc = mp.location || "Unknown";

          const member = await interaction.guild.members.fetch(mp.userId).catch(() => null);
          const displayName = member?.displayName || mp.username || "Unknown MP";

          if (!locationMap[loc]) {
            locationMap[loc] = [];
          }
          locationMap[loc].push(displayName);
        }

        // Create embed fields with each MP on a new line
        const locationFields = Object.entries(locationMap).map(([location, users]) => ({
          name: `📍 ${location}`,
          value: users.map(name => `- ${name}`).join("\n"),
          inline: false,
        }));

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
    }
  }    

  if (commandName === "travel") {
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

  if (commandName === 'action') {
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

  if (commandName === 'update-cabinet') {
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

  if (commandName == 'interest-rate')
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

  if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle("Bot Command Help")
      .setDescription("List of available commands and their brief descriptions:")
      .addFields(
        { name: "/refresh_channel", value: "Refresh the voice channel name (Server Director only)" },
        { name: "/check-mp-location [mp]", value: "Check location of a specific MP or all MPs" },
        { name: "/travel-to-location [location]", value: "Travel to a specified location (MP only)" },
        { name: "/test_bot", value: "Test bot functionality (Server Director only)" },
        { name: "/bot-stats", value: "Show bot uptime and version info" },
        { name: "/run-end-of-month", value: "Run end of month processes (Server Director only)" },
        { name: "/add-event-to-end-of-month [event_name]", value: "Add an event to the end of month list (Server Director only)" },
        { name: "/new-bill [bill_name] [bill_link]", value: "Add a new bill to the queue (MP only)" },
        { name: "/use-specialisation [action]", value: "Log a specialisation action (MP only)" },
        { name: "/change-cabinet-member [mp] [action] [role]", value: "Add or remove a cabinet role (PM only)" },
        { name: "/adjust-the-interest-rate [new_rate]", value: "Adjust the interest rate (Reserve Bank Gov only)" }
      )
      .setColor(0x00AAFF)
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [helpEmbed] });
    logCommandUsage(commandName, member, "Displayed help embed");
  }

  if (commandName === 'vote')
  {
    await interaction.reply('testing 123');
    logCommandUsage(commandName, member, 'No specific conditions');
  }

  if (commandName === 'law')
  {
    await interaction.reply('testing 123');
    logCommandUsage(commandName, member, 'No specific conditions');
  }

  if (commandName === 'resolution')
  {
    await interaction.reply('testing 123');
    logCommandUsage(commandName, member, 'No specific conditions');
  }

  else if (commandName === 'motion') {
    const details = options.getString('details');
    const allowedChannels = ['1296662777712082954', '1352771816682164224', '1289819911849513044', '1352558511376306226', '1289818637384941599'];

    if (!member.roles.cache.some(role => role.id === MEMBER_OF_PARLIMENT || role.id === SERVER_DIRECTOR)) {
      await interaction.reply('You must be a Member of Parliament to make motions.');
      return;
    }

    if (!allowedChannels.includes(interaction.channel.id)) {
      await interaction.reply('You can only use this command in parliament chamber or the debates forum.');
      return;
    }

    await interaction.reply('Motion initiated.');

    const dateObj = new Date();
    const currentDate = ("0" + dateObj.getDate()).slice(-2) + "-" +
        ("0" + (dateObj.getMonth() + 1)).slice(-2) + "-" +
        dateObj.getFullYear();

    const billEmbed = new EmbedBuilder()
      .setTitle("New Motion")
      .setDescription(`New Motion by **${member.displayName}**`)
      .addFields(
        { name: "Details", value: details, inline: false },
        { name: "Date", value: currentDate, inline: false }
      )
      .setColor(0x0099ff);

    const channel = await interaction.client.channels.fetch('1296662777712082954');
    await channel.send({ embeds: [billEmbed] });

    logCommandUsage(commandName, member, 'Motion command');
  }

  else if (commandName === 'info') {
    await interaction.reply('Select a member to view information about them.');
    logCommandUsage(commandName, member, 'Info command');
  }

  if (commandName === 'open-close-parliament') {
    const allowedChannels = ['1296662777712082954','1352555058210013194', '1289816803341504625'];
    if (!member.roles.cache.some(role => role.id  === LEADER_OF_THE_HOUSE ||  role.id  === PRODCEDUAL_CLERK ||  role.id  === OVERSIGHT_COUNCIL_CHAIR ||  role.id  === SERVER_DIRECTOR)) {
      await interaction.reply('Only the Leader of the House or Procedural Clerks can discipline members.');
    } else if (!allowedChannels.includes(interaction.channel.id)) {
      await interaction.reply('You can only open or close parliament in designated channels.');
    } else {
      await interaction.reply('Parliament chamber is now open/closed.');
    }
    logCommandUsage(commandName, member, 'Open/Close Parliament');
  }

  if (commandName === 'end-session') {
    const allowedChannels = ['1296662777712082954','1289816803341504625'];
    if (!member.roles.cache.some(role => role.id  === OVERSIGHT_COUNCIL_CHAIR ||  role.id  === SERVER_DIRECTOR)) {
      await interaction.reply('Only the Oversight Council Chairperson can end sessions.');
    } else if (allowedChannels.includes(interaction.channel.id)) {
      await interaction.reply('You can only end sessions in the Council Chair channel.');
    } else {
      await interaction.reply('Session ended, MP and Party roles updated.');
    }
    logCommandUsage(commandName, member, 'End session');
  }

  if (commandName === 'start-session') {
    const allowedChannels = ['1296662777712082954','1289816803341504625'];
    if (!member.roles.cache.some(role => role.id  === OVERSIGHT_COUNCIL_CHAIR ||  role.id  === SERVER_DIRECTOR)) {
      await interaction.reply('Only the Oversight Council Chairperson can start sessions.');
    } else if (allowedChannels.includes(interaction.channel.id)) {
      await interaction.reply('You can only start sessions in the Council Chair channel.');
    } else {
      await interaction.reply('Session started, roles updated.');
    }
    logCommandUsage(commandName, member, 'Start session');
  }

  if (commandName === 'discipline-member') {
    const allowedChannels = ['1296662777712082954','1352555058210013194', '1352771816682164224', '1289819911849513044', '1352558511376306226', '1289818637384941599'];

    if (!member.roles.cache.some(role => role.id === LEADER_OF_THE_HOUSE || role.id === PRODCEDUAL_CLERK || role.id === SERVER_DIRECTOR)) {
      await interaction.reply('Only the Leader of the House or Procedural Clerks can discipline members.');
      return;
    }

    if (!allowedChannels.includes(interaction.channel.id)) {
      await interaction.reply('You can only discipline members in specified parliamentary channels.');
      return;
    }

    const targetUser = options.getUser('mp');
    const days = options.getInteger('days');

    if (!targetUser) {
      await interaction.reply('You must specify a member to discipline.');
      return;
    }

    if (days < 1 || days > 7) {
      await interaction.reply('Days must be between 1 and 7.');
      return;
    }

    const guild = interaction.guild;
    const targetMember = await guild.members.fetch(targetUser.id);

    if (!targetMember.roles.cache.has(MEMBER_OF_PARLIMENT)) {
      await interaction.reply(`${targetMember.displayName} is not a Member of Parliament.`);
      return;
    }

    await targetMember.roles.remove(MEMBER_OF_PARLIMENT);
    await interaction.reply(`${targetMember.displayName} has been disciplined for ${days} day(s).`);

    // Convert days to milliseconds
    const msDelay = days * 24 * 60 * 60 * 1000;
    await delay(msDelay);

    // Restore role after delay
    await targetMember.roles.add(MEMBER_OF_PARLIMENT);

    // notify in the channel that role was restored
    await interaction.followUp(`${targetMember.displayName}'s Member of Parliament role has been restored after ${days} day(s).`);

    logCommandUsage(commandName, member, 'Discipline member');
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
  await startupUserLocations(await fetchAllMPs());
  await watchApplicationSheet(client);
}

startup();
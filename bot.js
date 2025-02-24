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
const {MEMBER_OF_PARLIMENT, ALLOWED_ROLES, ON_PARLIAMENT_GROUNDS} = require('./roles');
const {readCSV, saveToCSV} = require('./Functions/CSV');
const {USERS_CSV_PATH, getUserLocation, setUserLocation} = require('./Functions/UserLocation');
const {executeTimer, scheduleTimer, saveTimers, loadTimers} = require('./Functions/timers');
const {testGoogleSheetsConnection, downloadSheets, editCsv, uploadCsv} = require('./googleSheetsHandler');
const {updatePopulationData, updateEconomicSectors} = require('./EndOfMonth');

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

// Check if user has any of the allowed roles to use the command
async function hasPermission(member) {
    const DoesUserHavePermission = ALLOWED_ROLES.some(role => member.roles.cache.has(role));
    
    if (DoesUserHavePermission)
    {
        console.log('Passed Permissions Check:', member.user.username);
    }
    else
    {
        logCommandUsage("Permission Check Failed by:", member, 'Attempted to use restricted Command');
    };
    
    return DoesUserHavePermission;
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

// Update every 5 minutes
setInterval(updateVoiceChannel, 5 * 60 * 1000); // 5 minutes in milliseconds

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
    

    // Check if the user has the required roles for the command
    if (!await hasPermission(member)) {
        return interaction.reply({
            content: 'You do not have the required role to use this command.',
            ephemeral: true,
        });
    }

    // Handle the refresh command
    if (commandName === 'refresh') {
        try {
            await updateVoiceChannel();
            await interaction.reply('Voice channel name refreshed.');
            logCommandUsage(commandName, member, 'Manual refresh of voice channel name');
        } catch (error) {
            console.error('Command Refresh Failed:', error);
        }
    }

    if (commandName === "checklocation") {
        // Use the provided user, or default to the invoking user
        const targetUser = options.getUser("user") || user;
        try {
            const location = await getUserLocation(targetUser.id);
            console.log(location);
            console.log(targetUser.id);
            const displayLocation = location || "Unknown";
            await interaction.reply(`${targetUser.username}'s current location is: **${displayLocation}**`);
            logCommandUsage(commandName, interaction.member, `Checked location for ${targetUser.username}`);
        } catch (error) {
            console.error("Error checking location:", error);
            await interaction.reply("There was an error retrieving the location.");
        }
    }    

    if (commandName === "movelocation") {
        const targetUser = options.getUser('user') || user;
        const targetMember = await interaction.guild.members.fetch(user.id);
        const newLocation = options.getString("newlocation");

        if (!PossibleLocations.includes(newLocation)) {
            await interaction.reply(`Invalid location. Choose from: ${PossibleLocations.join(", ")}`);
            return;
        }

        try {
            await interaction.reply(`Moving **${targetUser.username}** to **${newLocation}** in ${MOVE_TIME / 1000} seconds...`);
            logCommandUsage(commandName, member, `Scheduled move to ${newLocation}`);

            setTimeout(async () => {
                try {
                    await setUserLocation(targetUser.id, targetUser.username, newLocation);
                    console.log(`${targetUser.username} has moved to: ${newLocation}`);
                    logCommandUsage(commandName, member, `Moved to ${newLocation}`);

                    if (newLocation != PossibleLocations[0])
                    {
                        await targetMember.roles.remove(ON_PARLIAMENT_GROUNDS);
                    }
                    else
                    {
                        await targetMember.roles.add(ON_PARLIAMENT_GROUNDS);
                    }

                    // Notify the user after moving
                    await interaction.followUp(`${targetUser.username} has arrived at **${newLocation}**.`);
                } catch (error) {
                    console.error("Error updating location after delay:", error);
                }
            }, MOVE_TIME);
        } catch (error) {
            console.error("Error initiating move location:", error);
            await interaction.reply("There was an error scheduling your location update.");
        }
    }

    // Handle each command
    if (commandName === 'test') {
        try {
            await interaction.reply('testing 123');
            logCommandUsage(commandName, member, 'No specific conditions');
        } catch (error) {
            console.error('Command Test Failed:', error);
        }
    }

    // Stats command
    if (commandName === 'stats') {
        try {
            const uptime = process.uptime(); // Get the bot uptime in seconds
            const days = Math.floor(uptime / (24 * 60 * 60));
            const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((uptime % (60 * 60)) / 60);
            const seconds = Math.floor(uptime % 60);
    
            await interaction.reply(`Version ${VERSION_ID}, Bot Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`);
            logCommandUsage(commandName, member, `Bot uptime requested`);
        } catch (error) {
            console.error('Command Stats Failed:', error);
        }
    }

    // endOfMonth command
    if (commandName === 'endofmonth') {
        try {
            downloadSheets();


        } catch (error) {
            console.error('Command End of Month Failed:', error);
        }
    }
});


// Log in to Discord
try {
    client.login(TOKEN);
} catch (error) {
    console.log('Failed to Login to discord');
}

// Load timers on startup
async function main() {
    await loadTimers();
    await downloadSheets();  // Waits for sheets to download before proceeding
    await updateEconomicSectors();  // Runs after download is complete
    await updatePopulationData()
}

main();

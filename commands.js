/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
// commands.js
// Commands Def File for Starhawk
//
// Discord: 
/////////////////////////////////////////////////////////////////

const { ApplicationCommandOptionType } = require('discord.js');
const { SecureLocations, PossibleLocations } = require('./Locations');

const commands = [
    { name: 'refresh', description: 'Manually refresh the count in the voice channel' },
    { name: 'test', description: 'Responds with "testing 123"' },
    { name: 'stats', description: 'Show the bot’s stats' },
    { name: 'endofmonth', description: 'Run the End of Month' },
    { name: 'checklocation', description: 'Check a user\'s current location.', options: [{ name: 'user', type: ApplicationCommandOptionType.User, description: 'Select a user to check their location', required: false }] },
    { name: 'movelocation', description: 'Move to a new location.', options: [{ name: 'newlocation', type: ApplicationCommandOptionType.String, description: 'Select your new location', required: true, choices: PossibleLocations.map(location => ({ name: location, value: location })) }] }
];

module.exports = { commands };

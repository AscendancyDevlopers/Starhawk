/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
// commands.js
// Commands Def File for Starhawk
//
// Discord: 
/////////////////////////////////////////////////////////////////

const {SecureLocations, PossibleLocations} = require('./Locations');

// Define the slash commands
const commands = [
    { name: 'refresh', description: 'Manually refresh the contractors count in the voice channel' },
    { name: 'test', description: 'Responds with "testing 123"' },
    { name: 'stats', description: 'Show the bot’s stats' },
    { name: 'checklocation', description: 'Check a user\'s current location.', options: [{ name: 'user', type: 6, description: 'Select a user to check their location', required: false }] },
    { name: 'movelocation', description: 'Move to a new location.', options: [{ name: 'newlocation', type: 3, description: 'Select your new location', required: true, choices: PossibleLocations.map(location => ({ name: location, value: location })) }] }
];


module.exports = {commands};
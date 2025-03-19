const { ApplicationCommandOptionType } = require('discord.js');
const { SecureLocations, PossibleLocations } = require('./Locations');

const commands = [
  {
    name: 'refresh_channel',
    description: 'Manually refresh the count in the voice channel'
  },
  {
    name: 'test_bot',
    description: 'Responds with "testing 123"'
  },
  {
    name: 'add_bill_for_oversight_committee',
    description: 'Add a bill to the Oversight Committees Queue',
    options: [
      {
        name: 'bill_link',
        type: ApplicationCommandOptionType.String,
        description: 'Link to the Bill document',
        required: true
      },
      {
        name: 'bill_name',
        type: ApplicationCommandOptionType.String,
        description: 'Name of the Bill',
        required: true
      }
    ]
  },
  {
    name: 'add_event_to_end_of_month',
    description: 'Add a Event to the End of Month Queue',
    options: [
      {
        name: 'event_name',
        type: ApplicationCommandOptionType.String,
        description: 'Event Name document',
        required: true
      }
    ]
  },
  {
    name: 'bot_stats',
    description: 'Show the bot’s stats'
  },
  {
    name: 'new_bill',
    description: 'Add a bill to the queue',
    options: [
      {
        name: 'bill_link',
        type: ApplicationCommandOptionType.String,
        description: 'Link to the Bill document',
        required: true
      },
      {
        name: 'bill_name',
        type: ApplicationCommandOptionType.String,
        description: 'Name of the Bill',
        required: true
      }
    ]
  },
  {
    name: 'use_specialisation',
    description: 'Use your specialisation at your current location'
  },
  {
    name: 'run_end_of_month',
    description: 'Run the End of Month',
    options: [
      {
        name: 'budget_link',
        type: ApplicationCommandOptionType.String,
        description: 'Link to the budget document',
        required: true
      }
    ]
  },
  {
    name: 'check_mp_location',
    description: "Check an MP's current location.",
    options: [
      {
        name: 'mp',
        type: ApplicationCommandOptionType.User,
        description: 'Select a user to check their location',
        required: false
      }
    ]
  },
  {
    name: 'travel_to_location',
    description: 'Travel to a new location.',
    options: [
      {
        name: 'travel_location',
        type: ApplicationCommandOptionType.String,
        description: 'Select your new location',
        required: true,
        choices: PossibleLocations.map(location => ({ name: location, value: location }))
      }
    ]
  }
];

module.exports = { commands };

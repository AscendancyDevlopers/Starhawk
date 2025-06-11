const { ApplicationCommandOptionType } = require('discord.js');
const { SecureLocations, PossibleLocations } = require('./Locations');
const { CABINETROLES } = require('./roles');
 

const commands = [
  {
    name: 'help',
    description: 'Embedded message that explains all of the commands.'
  },
  {
    name: 'vote',
    description: 'Create a vote with base reactions with a typeable title and description.',
    options: [
      {
        name: 'title',
        type: ApplicationCommandOptionType.String,
        description: 'Title of the vote',
        required: true
      },
      {
        name: 'description',
        type: ApplicationCommandOptionType.String,
        description: 'Description of the vote',
        required: true
      }
    ]
  },
  {
    name: 'law',
    description: 'Submit a law to the legislation committee.',
    options: [
      {
        name: 'link',
        type: ApplicationCommandOptionType.String,
        description: 'Google Docs link to the law',
        required: true
      }
    ]
  },
  {
    name: 'resolution',
    description: 'Submit a resolution to the Leader of the House.',
    options: [
      {
        name: 'link',
        type: ApplicationCommandOptionType.String,
        description: 'Google Docs link to the resolution',
        required: true
      }
    ]
  },
  {
    name: 'motion',
    description: 'Formally motion to initiate business or decision making.',
    options: [
      {
        name: 'details',
        type: ApplicationCommandOptionType.String,
        description: 'Details of the motion',
        required: true
      }
    ]
  },
  {
    name: 'travel',
    description: 'Travel to a location from a set list.',
    options: [
      {
        name: 'location',
        type: ApplicationCommandOptionType.String,
        description: 'Choose a destination',
        required: true,
        choices: PossibleLocations.map(loc => ({ name: loc.name, value: loc.name }))
      }
    ]
  },
  {
    name: 'action',
    description: 'Take an action at your current location.',
    options: [
      {
        name: 'activity',
        type: ApplicationCommandOptionType.String,
        description: 'Describe the action you are taking',
        required: true
      }
    ]
  },
  {
    name: 'info',
    description: 'Get info about a Member of Parliament.',
    options: [
      {
        name: 'mp',
        type: ApplicationCommandOptionType.User,
        description: 'Select a member of Parliament',
        required: true
      }
    ]
  },
  {
    name: 'update-cabinet',
    description: 'Add/Remove/Change a cabinet member\'s roles.',
    options: [
      {
        name: 'mp',
        type: ApplicationCommandOptionType.User,
        description: 'Target MP',
        required: true
      },
      {
        name: 'action',
        type: ApplicationCommandOptionType.String,
        description: 'Add or remove the cabinet role',
        required: true,
        choices: [
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        ]
      },
      {
        name: 'role',
        type: ApplicationCommandOptionType.String,
        description: 'Select cabinet role',
        required: true,
        choices: Object.keys(CABINETROLES).map(role => ({ name: role, value: role }))
      }
    ]
  },
  {
    name: 'bot-stats',
    description: 'Show the bot\'s uptime and version.'
  },
  {
    name: 'interest-rate',
    description: 'Adjust the current interest rate.',
    options: [
      {
        name: 'rate',
        type: ApplicationCommandOptionType.Number,
        description: 'New interest rate (0.00 - 100.00)',
        required: true
      }
    ]
  },
  {
    name: 'open-close-parliament',
    description: 'Opens or closes the parliament chamber.'
  },
  {
    name: 'end-session',
    description: 'Ends session, resets MP/party roles and adds waiting role.'
  },
  {
    name: 'start-session',
    description: 'Starts session, assigns MP and party awaiting roles.'
  },
  {
    name: 'check-mp-location',
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
    name: 'new-bill',
    description: 'Add a bill to the queue',
    options: [
      {
        name: 'bill_name',
        type: ApplicationCommandOptionType.String,
        description: 'Name of the Bill',
        required: true
      },
      {
        name: 'bill_link',
        type: ApplicationCommandOptionType.String,
        description: 'Link to the Bill document',
        required: true
      }
    ]
  },
  {
    name: 'add-event-to-end-of-month',
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
    name: 'discipline-member',
    description: 'Remove a member of Parliament for 1-7 days.',
    options: [
      {
        name: 'mp',
        type: ApplicationCommandOptionType.User,
        description: 'Member to discipline',
        required: true
      },
      {
        name: 'days',
        type: ApplicationCommandOptionType.Integer,
        description: 'Number of days (1-7)',
        required: true,
        choices: Array.from({ length: 7 }, (_, i) => ({ name: `${i + 1} day(s)`, value: i + 1 }))
      }
    ]
  }
];


module.exports = { commands };

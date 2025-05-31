const { ApplicationCommandOptionType } = require('discord.js');
const { SecureLocations, PossibleLocations } = require('./Locations');
// const { BillsInQueue } = require('./bot');
const { CABINETROLES } = require('./roles');
 

// if (!BillsInQueue || !Array.isArray(BillsInQueue)) {
//   console.error('BillsInQueue is not defined or not an array');
//   let BillsInQueue = [bill = ""];
// }

/*
Command List
/help
/vote
/law
/resolution
/motion
/travel
/action
/info
/update-cabinet
/bot-stats
/interest-rate
/open-close-parliament
/end-session
/start-session
/discipline-member
*/

const commands = [
  // {
  //   name: 'add-bill-for-oversight-council',
  //   description: 'Add a bill to the Oversight Councils Queue',
  //   options: [
  //     {
  //       name: 'bill_name',
  //       type: ApplicationCommandOptionType.String,
  //       description: 'Name of the Bill',
  //       required: true
  //     },
  //     {
  //       name: 'bill_link',
  //       type: ApplicationCommandOptionType.String,
  //       description: 'Link to the Bill document',
  //       required: true
  //     }
  //   ]
  // },
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
    name: 'adjust-the-interest-rate',
    description: 'Make a Change to the Interest Rate',
    options: [
      {
        name: 'new_rate',
        type: ApplicationCommandOptionType.Number,
        description: 'The New Interest Rate, 0.00 to 100.00',
        required: true
      }
    ]
  },  
  {
    name: 'bot-stats',
    description: 'Show the bot’s stats'
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
    name: 'use-specialisation',
    description: 'Use your specialisation at your current location',
    options: [
      {
        name: 'action',
        type: ApplicationCommandOptionType.String,
        description: 'What your doing at your location',
        required: true
      },
    ]
  },
  {
    name: 'run-end-of-month',
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
    name: 'change-cabinet-member',
    description: "Add or remove a Member of Parliament's cabinet position.",
    options: [
      {
        name: 'mp',
        type: ApplicationCommandOptionType.User,
        description: 'Select a Member of Parliament',
        required: true
      },
      {
        name: 'action',
        type: ApplicationCommandOptionType.String,
        description: 'Choose whether to add or remove the cabinet role',
        required: true,
        choices: [
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        ]
      },
      {
        name: 'role',
        type: ApplicationCommandOptionType.String,
        description: 'Select a cabinet role',
        required: true,
        choices: Object.keys(CABINETROLES).map(role => ({
          name: role,
          value: role
        }))
      }
    ]
  },
  {
    name: 'travel-to-location',
    description: 'Travel to a new location.',
    options: [
      {
        name: 'travel_location',
        type: ApplicationCommandOptionType.String,
        description: 'Select your new location',
        required: true,
        choices: PossibleLocations.map(location => ({ 
          name: location.name, 
          value: location.name 
        }))
      }
    ]
  }
  // {
  //   name: 'create-vote',
  //   description: 'Create a Vote',
  //   options: [
  //     {
  //       name: 'bill',
  //       type: ApplicationCommandOptionType.String,
  //       description: 'Select the bill you want to start a vote on',
  //       required: true,
  //       choices: PossibleLocations.map(location => ({ 
  //         name: location.name, 
  //         value: location.name 
  //       }))
  //     }
  //   ]
  // }
];

module.exports = { commands };

/////////////////////////////////////////////////////////////////
// Ascendancy Manager Bot - Starhawk
//
// Made by Shrike
// Roles.js 
//
// Discord: 
/////////////////////////////////////////////////////////////////

const SERVER_DIRECTOR = '1096597503371124846';
const MEMBER_OF_PARLIMENT = '1289810234826821674';
const ON_PARLIAMENT_GROUNDS = '1339056203220783215';
const AWAITING_PARTY_CHOICE = '1354749284876288031';
const LEADER_OF_THE_HOUSE = '1289811694024921119';
const PRIME_MINISTER = '1289811101050998784';
const CABINET_MEMBER = '1289812228693823519';
const SPECIAL_ADVISOR = '1348141072731340910';
const RESERVE_BANK_GOV = '1352813581275500554';

// Mapping of Area of Specialty to Discord Role IDs (adjust these IDs accordingly)
const AREAROLES = {
    "Security": "1348129501938454628",
    "Administrative": "1348129531445252179",
    "Media": "1348129572951949322",
    "Entrepreneurial": "1348129592296210512",
    "Finance": "1348129627251539978",
    "Community": "1348129645337378897",
    "Vocational": "1348129662886215700",
    "Judicial": "1348129683845283920"
  };

  // Mapping for Scholastic fields (when "Area of specialty:" is "Scholastic")
const SCHOLASTICFIELDROLES = {
    "Physics/Chemistry": "1348129704875393047",
    "Biology/Health/Medicine": "1348129776191143976",
    "Education/Teaching": "1348129838933872640",
    "History": "1348129862187090042",
    "Sociology": "1348129884500656280"
  };

const CABINETROLES = {
  "Leader of the House" : "1289811694024921119",
  "Deputy Prime Minister" : "1289811361156694128",
  "Secretary of Home Affairs" : "1289811390055583854",
  "Secretary of Finance" : "1289811508867366944",
  "Secretary of Foreign Affairs" : "1289811540748406885",
  "Attorney General" : "1289811579596181546"
};

module.exports = 
{
    MEMBER_OF_PARLIMENT,
    SERVER_DIRECTOR,
    ON_PARLIAMENT_GROUNDS,
    LEADER_OF_THE_HOUSE,
    SCHOLASTICFIELDROLES,
    AREAROLES,
    AWAITING_PARTY_CHOICE,
    CABINETROLES,
    PRIME_MINISTER,
    SPECIAL_ADVISOR,
    CABINET_MEMBER,
    RESERVE_BANK_GOV
};



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

const ALLOWED_ROLES = [SERVER_DIRECTOR, MEMBER_OF_PARLIMENT];

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

module.exports = 
{
    MEMBER_OF_PARLIMENT,
    SERVER_DIRECTOR,
    ALLOWED_ROLES,
    ON_PARLIAMENT_GROUNDS,
    SCHOLASTICFIELDROLES,
    AREAROLES
};



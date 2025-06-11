const {
  createLocation,
  listAllLocations,
  exportMapPNG
} = require('../SpaceLocations.js');

// Define each sub-location for Novum Domitros Union as an independent object
const GovernmentGrounds = {
  id: 0,
  name: 'Government Grounds',
  description: 'Key administrative complex housing the Unions Government.',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354674986907996202/Government_Grounds_Map.png'
};

const NovumCentrum = {
  id: 1,
  name: 'Novum Centrum',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675025256644618/Novum_Centrum_Map.png'
};

const Ventus = {
  id: 2,
  name: 'Ventus',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675027420643369/Ventus_Map.png'
};

const VisusPrimus = {
  id: 3,
  name: 'Visus Primus',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675027714379806/Visus_Primus_Map.png'
};

const TerraCibus = {
  id: 4,
  name: 'Terra Cibus',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675026695159819/Terra_Cibus_Map.png'
};

const Portus = {
  id: 5,
  name: 'Portus',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675025499918408/Portus_Map.png'
};

const Lacus = {
  id: 6,
  name: 'Lacus',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675028586663996/Lacus_Map.png'
};

const TrinusPoint = {
  id: 7,
  name: 'Trinus Point',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675027114463383/Trinus_Point_Map.png'
};

const Stella = {
  id: 8,
  name: 'Stella',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675026401689600/Stella_Map.png'
};

const Harena = {
  id: 9,
  name: 'Harena',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675028880392262/Harena_Map.png'
};

const SentinellaBase = {
  id: 10,
  name: 'Sentinella Military Base',
  description: '',
  isSecure: false,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354675025793384458/Sentinella_map.png'
};

const GovernmentBunker = {
  id: 11,
  name: 'Government Bunker',
  description: 'The Unions Secure Government Bunker.',
  isSecure: true,
  imageUrl: 'https://cdn.discordapp.com/attachments/1296662777712082954/1354674986907996202/Government_Grounds_Map.png'
};

/* 
Planets
*/
// Initialize Novum Domitros
const novumDomitros = createLocation({
  id: 0,
  name: 'Novum Domitros',
  description: 'Capital world of the Union',
  isPlanet: true,
  ownership: 'The Union',
  resources: {},
  imageUrl: ''
});

const theWall = createLocation({
  id: 1,
  name: 'The Wall',
  description: 'Frontier Station',
  isPlanet: false,
  ownership: 'The Union',
  resources: {},
  imageUrl: ''
});

const sorelMining = createLocation({
  id: 2,
  name: 'Sorel Mining Station',
  description: 'Mining Station',
  isPlanet: false,
  ownership: 'The Union',
  resources: {},
  imageUrl: ''
});

// Add each sub-location individually
[
  GovernmentGrounds,
  NovumCentrum,
  Ventus,
  VisusPrimus,
  TerraCibus,
  Portus,
  Lacus,
  TrinusPoint,
  Stella,
  Harena,
  SentinellaBase,
  GovernmentBunker
].forEach(sub => novumDomitros.addSubLocation(sub));

novumDomitros.addHyperRoute(1, 0.1);
novumDomitros.addHyperRoute(2, 0.098);
sorelMining.addHyperRoute(1, 0.01);
sorelMining.addHyperRoute(0, 0.098);
theWall.addHyperRoute(0, 0.1);
theWall.addHyperRoute(2, 0.01);

listAllLocations();
exportMapPNG("C:/Users/jschw/Downloads/Starhawk/test.png");
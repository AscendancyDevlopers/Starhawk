/* 
Each Location needs
Name
Description
Is it a planet
Connecting Hyper routes
Length of those connections
Location Ownership
Resources
ID Number
URL to Image
Sub Locations of the Space location
Name
Description
Sub Locations need is it a secure location
ID Number
URL to Image
*/

/*
Limits
max of 25 choices if using choice autofill
*/

/*
Command Setup
/travel {Space Location} - Optional,  {Sub Location} - Optional

Asks for confirm before moving
- Uses hidden message and react
- Includes Time to tarvel
- Location name
- Location Ownership
*/


/*
Location Setup
*/
// In-memory store
const LocationStore = new Map();

const {
  POSSIBLE_RESOURCES
} = require('./Resources.js');

// SubLocation class definition
class SubLocation {
  /**
   * @param {{ id: number, name: string, description: string, isSecure?: boolean, imageUrl?: string }} opts
   */
  constructor({ id, name, description, isSecure = false, imageUrl = '' }) {
    if (typeof id !== 'number') {
      throw new TypeError('SubLocation id must be a number');
    }
    this.id = id;
    this.name = name;
    this.description = description;
    this.isSecure = isSecure;
    this.imageUrl = imageUrl;
  }
}

// Location class
class Location {
  constructor({ id, name, description, isPlanet = false, ownership = '', resources = {}, imageUrl = '' }) {
    if (typeof id !== 'number') throw new TypeError('Location id must be a number');
    this.id = id;
    this.name = name;
    this.description = description;
    this.isPlanet = isPlanet;
    this.ownership = ownership;
    // initialize resource counts, default to zero for possible resources
    this.resources = {};
    POSSIBLE_RESOURCES.forEach(r => {
      this.resources[r] = resources[r] || 0;
    });
    this.imageUrl = imageUrl;
    this.hyperRoutes = [];
    this.subLocations = [];
  }

  /**
   * Connect this location to another via hyperroute
   * @param {number} destinationId
   * @param {number} length
   * @returns {Location}
   */
  addHyperRoute(destinationId, length) {
    if (typeof destinationId !== 'number') throw new TypeError('destinationId must be a number');
    if (typeof length !== 'number') throw new TypeError('length must be a number');
    this.hyperRoutes.push({ destinationId, length });
    return this;
  }

  /**
   * Add or subtract resources at this location
   * @param {string} type - must be one of POSSIBLE_RESOURCES
   * @param {number} amount - positive or negative integer
   * @returns {Location}
   */
  addResource(type, amount) {
    if (!POSSIBLE_RESOURCES.includes(type)) {
      throw new Error(`Invalid resource type: ${type}`);
    }
    if (typeof amount !== 'number') {
      throw new TypeError('amount must be a number');
    }
    this.resources[type] = (this.resources[type] || 0) + amount;
    return this;
  }

  /**
   * Add a sub-location under this location
   * @param {{ id: number, name: string, description: string, isSecure?: boolean, imageUrl?: string }} subLocData
   * @returns {SubLocation}
   */
  addSubLocation(subLocData) {
    const subLoc = new SubLocation(subLocData);
    this.subLocations.push(subLoc);
    return subLoc;
  }
}

/**
 * Factory: create and store a new location
 * @param {{ id: number, name: string, description: string, isPlanet?: boolean, ownership?: string, resources?: object, imageUrl?: string }} data
 * @throws {Error} if ID already exists
 * @returns {Location}
 */
function createLocation(data) {
  if (LocationStore.has(data.id)) {
    throw new Error(`Location with id ${data.id} already exists.`);
  }
  const loc = new Location(data);
  LocationStore.set(loc.id, loc);
  return loc;
}

/**
 * Retrieve a location by its numeric ID
 * @param {number} id
 * @returns {Location|null}
 */
function getLocation(id) {
  return LocationStore.get(id) || null;
}


/*
Function to read out all locations and ther sub locations
*/
const fs = require('fs');
const path = require('path');

function listAllLocations() {
  const result = [];
  for (const loc of LocationStore.values()) {
    const locData = {
      id: loc.id,
      name: loc.name,
      description: loc.description,
      isPlanet: loc.isPlanet,
      ownership: loc.ownership,
      resources: loc.resources,
      imageUrl: loc.imageUrl,
      hyperRoutes: loc.hyperRoutes.map(r => ({
        destinationId: r.destinationId,
        length: r.length
      })),
      subLocations: loc.subLocations.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        isSecure: s.isSecure,
        imageUrl: s.imageUrl
      }))
    };
    result.push(locData);
  }

  // Log to console
  console.log(JSON.stringify(result, null, 2));

  // Save to JSON file
  const outputPath = path.join(__dirname, 'Ascendancy Locations.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  return result;
}


/*
Location Setup to get pathing
*/
// Pathfinding using A* algorithm
function findShortestPath(startId, goalId) {
  const openSet = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  for (let loc of LocationStore.values()) {
    gScore.set(loc.id, Infinity);
    fScore.set(loc.id, Infinity);
  }
  gScore.set(startId, 0);
  fScore.set(startId, heuristic(startId, goalId));

  while (openSet.size > 0) {
    let current = [...openSet].reduce((a, b) => fScore.get(a) < fScore.get(b) ? a : b);
    if (current === goalId) {
      return reconstructPath(cameFrom, current);
    }
    openSet.delete(current);
    const currentLoc = getLocation(current);
    for (let neighbor of currentLoc.hyperRoutes) {
      const tentativeGScore = gScore.get(current) + neighbor.length;
      if (tentativeGScore < gScore.get(neighbor.destinationId)) {
        cameFrom.set(neighbor.destinationId, current);
        gScore.set(neighbor.destinationId, tentativeGScore);
        fScore.set(neighbor.destinationId, tentativeGScore + heuristic(neighbor.destinationId, goalId));
        openSet.add(neighbor.destinationId);
      }
    }
  }
  return null; // no path found
}

function heuristic(aId, bId) {
  // Simple heuristic: use constant 1 for all since we have no coordinates
  return 1;
}

function reconstructPath(cameFrom, current) {
  const totalPath = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    totalPath.unshift(current);
  }
  return totalPath;
}


/*
Map Creation for Validation
*/
// Function to generate a PNG map of all locations and hyper routes
const { execSync } = require('child_process');

/**
 * Export the current locations and hyper routes to a PNG file
 * @param {string} outputPath - file path to write the PNG (e.g. './map.png')
 */
function exportMapPNG(outputPath) {
  // Build Graphviz DOT description
  let dot = 'graph G {\n';
  dot += '  node [style=filled, fontname="Helvetica"];\n';

  // Define nodes (color by isPlanet)
  for (let loc of LocationStore.values()) {
    const color = loc.isPlanet ? 'lightblue' : 'lightgray';
    dot += `  ${loc.id} [label="${loc.name}", fillcolor=${color}];\n`;
  }

  // Define edges with distance labels (undirected)
  const seen = new Set();
  for (let loc of LocationStore.values()) {
    for (let route of loc.hyperRoutes) {
      const a = loc.id;
      const b = route.destinationId;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dot += `  ${a} -- ${b} [label="${route.length}"];\n`;
    }
  }

  dot += '}';

  // Write DOT to temp file and generate PNG
  const tmpDot = './map.dot';
  require('fs').writeFileSync(tmpDot, dot);
  execSync(`dot -Tpng ${tmpDot} -o ${outputPath}`);
  console.log(`Map exported to ${outputPath}`);
}

// Export for module usage
module.exports = {
  LocationStore,
  findShortestPath,
  createLocation,
  getLocation,
  listAllLocations,
  exportMapPNG
};
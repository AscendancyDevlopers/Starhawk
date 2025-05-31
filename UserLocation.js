const { SecureLocations, PossibleLocations } = require('./Locations');

// In-memory store for user locations
const userLocations = new Map();

// Get a user's location
async function getUserLocation(userId) {
    const data = userLocations.get(String(userId));
    if (!data) return null;

    const locationObj = PossibleLocations.find(loc => loc.name === data.location);
    return locationObj ? locationObj.name : data.location;
}

// Set or update a user's location
async function setUserLocation(userId, username, newLocation) {
    userLocations.set(String(userId), {
        username,
        location: newLocation
    });
}

// Get all user locations
async function getAllUserLocations() {
    return Array.from(userLocations.entries()).map(([userId, { username, location }]) => ({
        userId,
        username,
        location
    }));
}

// Set all given users to "Government Grounds"
function startupUserLocations(userList) {
    const defaultLocation = "Government Grounds";
    userList.forEach(user => {
        userLocations.set(String(user.id), {
            username: user.username,
            location: defaultLocation
        });
    });
}

module.exports = {
    getUserLocation,
    setUserLocation,
    getAllUserLocations,
    startupUserLocations
};
const fs = require("fs");
const csv = require("csv-parser");

const USERS_CSV_PATH = "csv_files/MP_Locations.csv";
const {SecureLocations, PossibleLocations} = require('./Locations');

// Function to read CSV and get a user's location
async function getUserLocation(userId) {
    return new Promise((resolve, reject) => {
      let foundLocation = null;
  
      fs.createReadStream(USERS_CSV_PATH)
        .pipe(csv())
        .on("data", (row) => {
          // Use either lower-case or upper-case header, whichever exists
          const id = row.userId || row.UserID;
          if (id === String(userId)) {
            foundLocation = row.location || row.Location;
          }
        })
        .on("end", () => {
          if (foundLocation) {
            // Check the possible locations array for a matching location.
            const locationObj = PossibleLocations.find(loc => loc.name === foundLocation).name;
            resolve(locationObj || foundLocation);
          } else {
            resolve(null);
          }
        })
        .on("error", reject);
    });
  }  

// Function to update a user's location (or add if missing)
async function setUserLocation(userId, username, newLocation) {
    return new Promise((resolve, reject) => {
        const users = [];
        let userUpdated = false;

        fs.createReadStream(USERS_CSV_PATH)
            .pipe(csv())
            .on("data", (row) => {
                // Normalize the userId key (supports "userId" or "UserID")
                const currentUserId = row.userId || row.UserID || "";
                // If this row matches the provided userId, update its location.
                if (currentUserId === String(userId)) {
                    row.location = newLocation;
                    userUpdated = true;
                }
                // Push a normalized row into our array.
                users.push({
                    userId: currentUserId,
                    username: row.username || row.Username || username,
                    location: row.location || row.Location || newLocation
                });
            })
            .on("end", () => {
                // If no matching user was found, add a new row.
                if (!userUpdated) {
                    users.push({ userId: String(userId), username, location: newLocation });
                }

                // Optionally filter out empty rows (rows with missing userId)
                const validUsers = users.filter(u => u.userId && u.userId.trim() !== "");

                // Convert the array to CSV data manually
                const header = "userId,username,location";
                const csvRows = validUsers.map(u => `${u.userId},${u.username},${u.location}`);
                const csvData = [header, ...csvRows].join("\n");

                fs.writeFile(USERS_CSV_PATH, csvData, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            })
            .on("error", reject);
    });
}

// Function to get all user locations from the CSV
async function getAllUserLocations() {
    return new Promise((resolve, reject) => {
        const locations = [];
        fs.createReadStream(USERS_CSV_PATH)
            .pipe(csv())
            .on("data", (row) => {
                // Normalize keys (support both lower-case and upper-case headers)
                const userId = row.userId || row.UserID;
                const username = row.username || row.Username;
                const location = row.location || row.Location;
                if (userId && userId.trim() !== "") {
                    locations.push({ userId: String(userId), username, location });
                }
            })
            .on("end", () => resolve(locations))
            .on("error", reject);
    });
}

module.exports = { USERS_CSV_PATH, getUserLocation, setUserLocation, getAllUserLocations };


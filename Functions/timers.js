const { setTimeout } = require("timers");
const path = require('path');
const timersFile = path.join(__dirname, "timers.json");
const fs = require('fs');
let activeTimers = {};

// Load saved timers on startup
function loadTimers() {
    if (fs.existsSync(timersFile)) {
        try {
            const data = fs.readFileSync(timersFile, "utf8");
            activeTimers = JSON.parse(data);

            // Check and start timers
            for (const [id, timer] of Object.entries(activeTimers)) {
                if (new Date(timer.endTime) > new Date()) {
                    scheduleTimer(id, timer.endTime, timer.callbackFunction);
                } else {
                    executeTimer(id, timer.callbackFunction);
                }
            }
        } catch (error) {
            console.error("Error loading timers:", error);
        }
    }
}

// Save timers to file
function saveTimers() {
    fs.writeFileSync(timersFile, JSON.stringify(activeTimers, null, 4));
}

// Schedule a new timer
function scheduleTimer(id, endTime, callbackFunction) {
    const timeLeft = new Date(endTime) - new Date();
    if (timeLeft <= 0) {
        executeTimer(id, callbackFunction);
        return;
    }

    activeTimers[id] = { endTime, callbackFunction };
    saveTimers();

    setTimeout(() => executeTimer(id, callbackFunction), timeLeft);
}

// Execute a timer function and remove from storage
async function executeTimer(id, callbackFunction) {
    console.log(`Executing timer: ${id}`);
    
    try {
        await callbackFunction();
    } catch (error) {
        console.error(`Error executing timer ${id}:`, error);
    }

    delete activeTimers[id];
    saveTimers();
}

module.exports = 
{
    executeTimer,
    scheduleTimer,
    saveTimers,
    loadTimers
};


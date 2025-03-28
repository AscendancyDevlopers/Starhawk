const { setTimeout } = require("timers");
let activeTimers = {};


// Schedule a new timer
function scheduleTimer(id, endTime, callbackFunction) {
    const timeLeft = new Date(endTime) - new Date();
    if (timeLeft <= 0) {
        executeTimer(id, callbackFunction);
        return;
    }

    activeTimers[id] = { endTime, callbackFunction };

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
}

module.exports = 
{
    executeTimer,
    scheduleTimer
};


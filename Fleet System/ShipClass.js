/* Ship Class
- ID
- Class Name
- Owner
- Design Company
- Slots[]
- Class Size
- Cost
- Resources Needed[] */

const {
  Slot
} = require('./Slot.js');

const {
  component
} = require('./Component.js');

class ShipClass {
    constructor(ID, ClassName, Owner, Designer, size) {
        this.ID = ID;
        this.ClassName = ClassName;
        this.Owner = Owner;
        this.Designer = Designer;
        this.Slots = [];
        this.Size = this.setSize(size);
        this.cost = new Number(10);
        this.ResourcesNeeded = [];
    }

    setSize(size) {
        this.Slots = [];

        const sizeMap = {
        "Fighter": { "Tiny": 4 },
        "Corvette": { "Small": 4 },
        "Frigate": { "Small": 4, "Medium": 2 },
        "Destroyer": { "Small": 4, "Medium": 6 },
        "Light Crusier": { "Small": 4, "Medium": 10 },
        "Heavy Crusier": { "Small": 4, "Large": 6 },
        "Capital": { "Medium": 6, "Large": 12 },
        "Titan": { "Small": 6, "Large": 20, "Huge": 4 },
        };

        const costMap = {
        "Fighter": 10,
        "Corvette": 20,
        "Frigate": 30,
        "Destroyer": 40,
        "Light Crusier": 50,
        "Heavy Crusier": 60,
        "Capital": 70,
        "Titan": 80,
        };

        this.cost = new Number(costMap[size]);

        const slots = sizeMap[size];
        if (!slots) return;

        for (const [slotSize, count] of Object.entries(slots)) {
        for (let i = 0; i < count; i++) {
            this.Slots.push(new Slot(slotSize));
        }
        }

        return size;
    }

    addComponent(slotIndex, component) {
        if (slotIndex < 0 || slotIndex >= this.Slots.length) {
        throw new Error("Invalid slot index");
        }
        const slot = this.Slots[slotIndex];

        if (slot.content !== null) {
        throw new Error("Slot already occupied");
        }

        if (slot.size !== component.Size) {
        throw new Error(
            `Component size (${component.Size}) does not match slot size (${slot.size})`
        );
        }

        this.cost =  new Number(this.cost + component.cost);
        slot.content = component;
    }

    showShipClass() {
        console.log(`ID: ${this.ID}`);
        console.log(`ClassName: ${this.ClassName}`);
        console.log(`Owner: ${this.Owner}`);
        console.log(`Designer: ${this.Designer}`);
        console.log(`Size: ${this.Size}`);
        console.log(`Cost: ${this.cost}`);
        console.log(`Resources Needed:`, this.ResourcesNeeded);

        console.log("Slots:");
        this.Slots.forEach((slot, index) => {
        if (slot.content) {
            console.log(
            `  Slot ${index}: Size=${slot.size}, Component ID=${slot.content.ID}, Type=${slot.content.Type}, Cost=${slot.content.cost}`
            );
        } else {
            console.log(`  Slot ${index}: Size=${slot.size}, Empty`);
        }
        });
    }
}

module.exports =
{
    ShipClass
}
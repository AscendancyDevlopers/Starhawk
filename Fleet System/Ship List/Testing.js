const {
  Slot
} = require('../Slot.js');

const {
  component
} = require('../Component.js');

const {
  ShipClass
} = require('../ShipClass.js');

/* Slot Sizes
Tiny
Small
Medium 
Large
Huge*/

/* Testing */
const Armour = new component(0, "Armour", "Small", "", new Number(50.0));
const Radar = new component(1, "Radar", "Small", "", new Number(50.0));
const Laser = new component(2, "Laser", "Small", "", new Number(50.0));
const Reactor = new component(3, "Reactor", "Medium", "", new Number(50.0));


const TestingShipClass = new ShipClass(1, "Falcon Class", "Player1", "StarTech", "Frigate");
TestingShipClass.addComponent(0, Armour);
TestingShipClass.addComponent(1, Radar);
TestingShipClass.addComponent(2, Laser);
TestingShipClass.addComponent(3, Laser);
TestingShipClass.addComponent(4, Reactor);
TestingShipClass.addComponent(5, Reactor);

TestingShipClass.showShipClass();
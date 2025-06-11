/* Component
- ID
- Type
- Size
- Info
- Cost
- Resources Needed[] */

/* Slot Sizes
Tiny
Small
Medium 
Large
Huge*/

class component {
  constructor(id, type, size, info, cost, resourcesNeeded = []) {
    this.ID = id;
    this.Type = type;
    this.Size = size;
    this.Info = info;
    this.cost = new Number(cost);
    this.ResourcesNeeded = resourcesNeeded;
  }
}

module.exports =
{
    component
}
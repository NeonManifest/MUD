// Base class for all game entities
class Entity {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  describe() {
    return `${this.name}: ${this.description}`;
  }
}

// Player class extending Entity
class Player extends Entity {
  constructor(name, description, clan = null) {
    super(name, description);
    this.inventory = [];
    this.attributes = {
      hp: 100,
      mp: 100,
      tp: 100,
      strength: 10,
      dexterity: 10,
      magic: 10,
      luck: 10,
    };
    this.clan = clan;
  }

  addItem(item) {
    this.inventory.push(item);
  }

  removeItem(itemName) {
    this.inventory = this.inventory.filter((item) => item.name !== itemName);
  }

  // Additional player-specific methods
}

// NPC class extending Entity
class NPC extends Entity {
  constructor(name, description) {
    super(name, description);
    this.dialogue = [];
    // Add more NPC-specific properties as needed
  }

  addDialogue(line) {
    this.dialogue.push(line);
  }

  // Additional NPC-specific methods
}

// Item class extending Entity
class Item extends Entity {
  constructor(name, description, weight = 1) {
    super(name, description);
    this.weight = weight;
    // Add more item-specific properties as needed
  }

  // Additional item-specific methods
}

module.exports = { Entity, Player, NPC, Item };

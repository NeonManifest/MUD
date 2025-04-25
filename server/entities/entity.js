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
  constructor(name, description, clan = null, job = "Rookie") {
    super(name, description);
    this.inventory = [];
    this.clan = clan;
    this.job = job;
    this.level = { job: 1 };
    this.experience = { job: 0 };
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
  }

  addDialogue(line) {
    this.dialogue.push(line);
  }
}

// Item class extending Entity
class Item extends Entity {
  constructor(name, description) {
    super(name, description);
  }
}

export default { Entity, Player, NPC, Item };

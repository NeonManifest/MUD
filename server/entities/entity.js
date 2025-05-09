import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Battler } from "./battler.js";

// Get the directory name using ES module approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse the JSON files
const jobsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../world/jobs.json"), "utf8")
);
const monstersData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../world/monsters.json"), "utf8")
);

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
  constructor(
    name,
    description,
    clan = null,
    job = "Rookie",
    currentRoom = "town-square"
  ) {
    super(name, description);
    this.inventory = [];
    this.clan = clan;
    this.job = job;
    this.level = { job: 1 };
    this.experience = { job: 0 };
    this.currentRoom = currentRoom;
    //Initialize battler for player based on their job from jobs.json
    const battleOptions = Player.calculateBattleOptions(job, this.level.job);
    this.battler = new Battler(battleOptions);
  }

  static calculateBattleOptions(jobName, level) {
    try {
      // Get the job stats from the imported data
      const job = jobsData[jobName] || jobsData["Rookie"];
      if (!job) {
        throw new Error(`Job ${jobName} not found in jobs data`);
      }
      // Calculate stats based on job base stats and level
      return {
        hitPoints: Math.floor(job.BaseHp + job.HpGrowth * (level - 1)),
        maxHitPoints: Math.floor(job.BaseHp + job.HpGrowth * (level - 1)),
        attack: Math.floor(job.BaseAttack + job.AttackGrowth * (level - 1)),
        guard: Math.floor(job.BaseGuard + job.GuardGrowth * (level - 1)),
        agility: Math.floor(job.BaseAgi + job.AgiGrowth * (level - 1)),
      };
    } catch (error) {
      console.error("Error calculating battle options:", error);
      // Return default values if there's an error
      return {
        hitPoints: 100,
        maxHitPoints: 100,
        attack: 5,
        guard: 5,
        agility: 5,
      };
    }
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

class Monster extends Entity {
  constructor(name, currentRoom = "town-square") {
    super(name, monstersData[name].description);
    const battleOptions = Monster.calculateBattleOptions(name);
    this.battler = new Battler(battleOptions);
    this.xp = monstersData[name].xp;
    this.currentRoom = currentRoom;
  }
  static calculateBattleOptions(monsterName) {
    try {
      // Get the monster stats from the imported data
      const monster = monstersData[monsterName] || monstersData["Rat"];
      if (!monster) {
        throw new Error(`Monster ${monsterName} not found in monsters data`);
      }
      // Calculate stats based on monster base stats
      return {
        hitPoints: monster.hp,
        maxHitPoints: monster.hp,
        attack: monster.attack,
        guard: monster.guard,
        agility: monster.agi,
      };
    } catch (error) {
      console.error("Error calculating battle options:", error);
      // Return default values if there's an error
      return {
        hitPoints: 20,
        maxHitPoints: 20,
        attack: 5,
        guard: 5,
        agility: 5,
      };
    }
  }
}

export default { Entity, Player, NPC, Item, Monster };

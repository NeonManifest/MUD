export class Battler {
  constructor(options = {}) {
    this.hitPoints = options.hitPoints || 100;
    this.maxHitPoints = options.maxHitPoints || 100;
    this.attack = options.attack || 10;
    this.guard = options.guard || 5;
    this.agility = options.agility || 5;
    this.isInCombat = false;
    this.combatTarget = null;
  }

  takeDamage(amount) {
    const actualDamage = Math.max(1, amount - this.guard);
    this.hitPoints = Math.max(0, this.hitPoints - actualDamage);
    return actualDamage;
  }

  heal(amount) {
    this.hitPoints = Math.min(this.maxHitPoints, this.hitPoints + amount);
    return this.hitPoints;
  }

  attackTarget(target) {
    if (!target || !target.battler) return 0;

    // Calculate hit chance based on agility difference
    const hitChance = 0.7 + (this.agility - target.battler.agility) * 0.05;

    if (Math.random() <= hitChance) {
      return target.battler.takeDamage(this.attack);
    }
    return 0; // Miss
  }

  startCombat(target) {
    this.isInCombat = true;
    this.combatTarget = target;
  }

  endCombat() {
    this.isInCombat = false;
    this.combatTarget = null;
  }

  isDead() {
    return this.hitPoints <= 0;
  }
}

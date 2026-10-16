import { applyGear } from "./classgear.js";
import { applyQuestItems } from "./systems/quests.js";
// Datos del juego (generados por tools/convert.py a partir de los .cfg del servidor).
export class GameData {
  constructor({ items = {}, npcs = {}, magic = {}, potions = [] }) {
    this.magic = magic;
    this.potions = potions;
    this.items = new Map();
    this.byName = new Map();
    applyGear(items); applyQuestItems(items);
    for (const [id, d] of Object.entries(items)) {
      d.id = +id;
      this.items.set(d.id, d);
      this.byName.set(d.name, d);
    }
    this.npcs = npcs;
  }
  item(id) { return this.items.get(id); }
  named(name) { return this.byName.get(name); }
}

// Cuadro «Guild» (id 34, Ctrl+G): el guild del original (Guildmaster / Guildsman) con lo que añade el port. La lógica vive en shared/systems/guild.js.
//   Sin guild: requisitos para fundar (nivel 20, carisma 20, en un pueblo) y «/guild create Nombre».
//   Con guild: miembros (rango, conectado, nivel), invitar al jugador bajo el cursor o el más cercano, salir, expulsar (clic en un miembro), disolver
//   y, el Guildmaster, el color de capa y botas (tintes de Item.cfg) que verán todos los que las lleven puestas.
//   Chat «@texto»: lo leen los miembros de cualquier mapa. Comandos: /guild create|invite|leave|kick|disband|cape N|boots N.
import { ClassicDialog, INK, RED, WHITE } from "./classicdialog.js";
import { DYE_RGB } from "./look.js";
import { MIN_LEVEL, MIN_CHR } from "../shared/systems/guild.js";

const inside = (lx, ly, x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
const COLOR_NAMES = ["Default", "Indigo", "Olive", "Gold", "Crimson", "Green", "Gray", "Aqua", "Pink", "Violet", "Blue", "Tan", "Khaki", "Yellow", "Red", "Black"];

export function registerGuild(gui, api) {
  const dlg = new class extends ClassicDialog {
    constructor() { super({ id: 34, x: 140, y: 70, title: "Guild", rowH: 15, top: 60, visible: 8 }); this.mx = 16; this.mode = "info"; this.g = null; this.query = null; this.sel = null; }
    me() { return api.me(); }
    rows(me) {
      if (this.mode === "query" || !me?.guild || !this.g) return [];
      return this.g.members.map(m => ({ text: (m.r === 0 ? "★ " : "  ") + m.n + (m.n === me.name ? " (you)" : ""), right: m.on ? "Lv " + m.lv : "off", color: m.on ? null : "#6a5a46", member: m, tip: m.r === 0 ? "Guildmaster" : "Guildsman" + (me.guild.rank === 0 ? " · click to select; [Kick] dismisses" : "") }));
    }
    pick(r) { this.sel = r.member.n === this.sel ? null : r.member.n; }
    drawBody(g, me, lx, ly) {
      const line = (y, s, c = INK) => g.aligned(0, this.w, y, s, c), btn = (x, y, s, on = true) => g.text(x, y, "[ " + s + " ]", !on ? "#6a5a46" : inside(lx, ly, x - 4, x + 8 + s.length * 6.5, y - 3, y + 14) ? WHITE : RED, { size: 11, bold: true });
      if (this.mode === "query") { line(100, this.query.from + " invites you to"); line(115, "the guild " + this.query.guild + "."); btn(40, 170, "Accept"); btn(150, 170, "Decline"); return; }
      if (!me?.guild) {
        ["You do not belong to a guild.", "", `To found one you need level ${MIN_LEVEL},`, `charisma ${MIN_CHR} and to be in a town.`, "", "Type: /guild create Name", "Or ask a Guildmaster to invite you."].forEach((s, i) => line(78 + i * 15, s));
        return;
      }
      const gd = me.guild;
      line(40, gd.name + (this.g ? "  ·  " + this.g.members.length + " members" : ""), RED);
      const master = gd.rank === 0, y = 196;
      btn(16, y, "Invite", master); btn(88, y, "Kick", master && !!this.sel); btn(148, y, "Leave"); btn(204, y, "Disband", master);
      if (master) {
        g.text(16, y + 20, "Cape", INK, { size: 11 }); this.swatch(g, 52, y + 18, gd.cape);
        g.text(130, y + 20, "Boots", INK, { size: 11 }); this.swatch(g, 172, y + 18, gd.boots);
      } else line(y + 20, "Cape and boots: " + COLOR_NAMES[gd.cape || 0] + " / " + COLOR_NAMES[gd.boots || 0]);
    }
    swatch(g, x, y, c) { g.text(x, y + 2, "◄", INK, { size: 11 }); g.ctx.fillStyle = DYE_RGB[c] || "#b8a888"; g.ctx.fillRect(x + 14, y + 1, 34, 13); g.text(x + 54, y + 2, "►", INK, { size: 11 }); }
    click(g, lx, ly, me) {
      if (this.mode === "query") {
        if (inside(lx, ly, 36, 110, 167, 184)) { api.send({ t: "guildanswer", r: 1 }); this.mode = "info"; api.send({ t: "guildinfo" }); }
        else if (inside(lx, ly, 146, 220, 167, 184)) { api.send({ t: "guildanswer", r: 0 }); this.mode = "info"; this.query = null; if (!me?.guild) g.close(this.id); }
        return true;
      }
      if (me?.guild) {
        const y = 196, master = me.guild.rank === 0, hit = (x, w) => inside(lx, ly, x - 4, x + w, y - 3, y + 14);
        if (master && hit(16, 50)) { api.autoInvite(); return true; }
        if (master && this.sel && hit(88, 40)) { api.send({ t: "guildkick", name: this.sel }); this.sel = null; return true; }
        if (hit(148, 50)) { api.send({ t: "guildleave" }); return true; }
        if (master && hit(204, 60)) { api.send({ t: "guilddisband" }); return true; }
        if (master) for (const [key, x] of [["cape", 52], ["boots", 172]]) {
          const cur = me.guild[key] || 0;
          if (inside(lx, ly, x - 2, x + 10, y + 16, y + 34)) { api.send({ t: "guildcolor", [key]: (cur + 15) % 16 }); return true; }
          if (inside(lx, ly, x + 50, x + 66, y + 16, y + 34)) { api.send({ t: "guildcolor", [key]: (cur + 1) % 16 }); return true; }
        }
      }
      return super.click(g, lx, ly, me);
    }
    hoverOk() { return false; }
    onClose() { if (this.mode === "query" && this.query) api.send({ t: "guildanswer", r: 0 }); this.mode = "info"; }
  }();
  gui.register(dlg);
  const open = () => { api.send({ t: "guildinfo" }); if (!gui.isOpen(34)) gui.open(34); else gui.front?.(34); };
  return {
    open,
    command(txt) {                                                  // «/guild …»
      const [, cmd, arg] = /^\/guild\s*(\w*)\s*(.*)$/.exec(txt) || [];
      switch (cmd) {
        case "": case "info": open(); break;
        case "create": api.send({ t: "guildcreate", name: arg }); break;
        case "invite": api.send({ t: "guildinvite", name: arg }); break;
        case "leave": api.send({ t: "guildleave" }); break;
        case "kick": api.send({ t: "guildkick", name: arg }); break;
        case "disband": api.send({ t: "guilddisband" }); break;
        case "cape": case "boots": api.send({ t: "guildcolor", [cmd]: +arg }); break;
        default: api.log("/guild create|invite|leave|kick|disband|cape N|boots N");
      }
    },
    onEvent(ev, me) {
      if (ev.id !== me?.id) return;
      if (ev.t === "guildquery") { dlg.mode = "query"; dlg.query = { from: ev.from, guild: ev.guild }; if (!gui.isOpen(34)) gui.open(34); else gui.front?.(34); return; }
      if (ev.t === "guildchat") { api.log("[Guild] " + ev.name + ": " + ev.text, "guild"); return; }
      if (ev.t !== "guild") return;
      switch (ev.k) {
        case "info": dlg.g = ev.guild; break;
        case "created": api.log("You founded the guild " + ev.name + ". You are its Guildmaster.", "gold"); api.send({ t: "guildinfo" }); break;
        case "joined": api.log(ev.name + " joined the guild.", "guild"); api.send({ t: "guildinfo" }); break;
        case "left": api.log(ev.name + " left the guild.", "guild"); api.send({ t: "guildinfo" }); break;
        case "master": api.log(ev.name + " is the new Guildmaster.", "guild"); api.send({ t: "guildinfo" }); break;
        case "colors": api.log("The guild colors changed.", "guild"); break;
        case "left-silent": case "kicked": api.log(ev.k === "kicked" ? "You were dismissed from the guild " + ev.guild + "." : "You left the guild " + ev.guild + ".", "gold"); dlg.g = null; break;
        case "disbanded": api.log("The guild " + ev.guild + " was disbanded.", "gold"); dlg.g = null; break;
        case "refused": api.log(ev.name + " declined the invitation."); break;
        case "fail": api.log("Guild: " + ev.why, "bad"); break;
      }
    },
  };
}

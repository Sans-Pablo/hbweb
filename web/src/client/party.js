// Cuadro de grupo (Party), id 32: DrawDialogBox_Party / DlgBoxClick_Party del cliente original (Client/Game.cpp) con sus textos (LAN_ENG.H).
// La lógica vive en shared/systems/party.js; aquí solo se pinta y se mandan órdenes (partyreq, partyaccept, partyleave) y se reaccionan eventos.
//   modos: 0 menú · 1 invitación recibida · 2 elige a quién invitar (clic en un personaje) · 3 esperando respuesta · 4 lista de miembros
//          5 retirándose · 6 te retiraste · 7 fallo al retirarse · 8 entraste · 9 fallo al entrar · 10 grupo disuelto · 11 ¿retirarse?
const INK = "#2d1919", DARK = "#040032", WHITE = "#fff", GRAY = "#414141";
const BTN = { w: 74, h: 20, left: 30, right: 154, y: 292 };
const within = (lx, ly, x1, x2, y1, y2) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
const TEXT = {
  0: ["Join a party.", "Withdraw from the party.", "See the list of party members."],
  1: ["%s offered you to", "join the party. You can", "share the experience by", "the ratio of level if", "you join the party."],
  2: ["Click the character which", "you want to join. Press", "cancel button to cancel", "joining the party."],
  3: ["You asked %s to", "join party. Please wait", "until he responds. Press", "cancel button to cancel", "making party."],
  4: ["The character name", "of your party."],
  5: ["withdrawing from the party.", "Please wait a moment."],
  6: ["You withdrew from the party."],
  7: ["Failed in withdrawing from the party.", "If you fail repeatedly, you", "can withdraw from the party", "by logging out."],
  8: ["You joined the party.", "You can share the experience", "with your party. And you don't", "have to set the safe attack", "mode with your party. So you", "can play efficiently."],
  9: ["Failed in joining the", "party. Maybe the player", "rejected or the case you", "offered to enemy or you", "offered to player who is", "not in peace mode."],
  10: ["Your party has been dismissed.", "If the number of members is 1", "the party dismisses automatically."],
  11: ["Would you like to withdraw from the party?"],
};

export function registerParty(gui, api) {
  const d = {
    id: 32, x: 160, y: 90, w: 258, h: 339, mode: 0, name: "",
    status: me => (me && me.party ? 1 : 0),
    show(mode) { this.mode = mode; if (!gui.isOpen(32)) gui.open(32); else gui.front?.(32); },
    draw(g, me) {
      const lx = g.mouse.x - this.x, ly = g.mouse.y - this.y, inParty = !!(me && me.party);
      g.put("gamedialog_1", 0, 0, 0); g.put("dialogtext_0", 3, 0, 0);
      const line = (y, s, c = INK) => g.aligned(0, this.w, y, s, c);
      const lines = TEXT[this.mode], base = this.mode === 0 ? 0 : 95;
      if (this.mode === 0) {
        [["Join a party.", 85, !inParty], ["Withdraw from the party.", 105, inParty], ["See the list of party members.", 125, inParty]].forEach(([s, y, on], i) => {
          const hot = on && within(lx, ly, 80, 195, y - 5, y + 15);
          line(y, s, !on ? GRAY : hot ? WHITE : DARK);
        });
        (inParty ? ["You are in a party. You can", "withdraw from the party or", "see the list of party members."] : ["You are not in a party.", "You can make a party with", "other players."]).forEach((s, i) => line(155 + i * 15, s));
      } else if (this.mode === 4) {
        line(95, lines[0]); line(110, lines[1]);
        (me?.party?.names || []).forEach((n, i) => g.aligned(17, 270, 140 + 15 * i, n, INK));
      } else lines.forEach((s, i) => line(base + i * 15 + (this.mode === 1 && i === 0 ? 0 : 0), s.replace("%s", this.name)));
      const hov = (x) => within(lx, ly, x, x + BTN.w, BTN.y, BTN.y + BTN.h);
      const put = (x, a, b) => g.put("dialogtext_1", hov(x) ? b : a, x, BTN.y);
      switch (this.mode) {
        case 0: put(BTN.right, 0, 1); break;
        case 1: case 11: put(BTN.left, 18, 19); put(BTN.right, 2, 3); break;
        case 2: case 3: put(BTN.right, 16, 17); break;
        case 5: break;
        default: put(BTN.right, 0, 1);
      }
    },
    click(g, lx, ly, me) {
      const L = within(lx, ly, BTN.left, BTN.left + BTN.w, BTN.y, BTN.y + BTN.h), R = within(lx, ly, BTN.right, BTN.right + BTN.w, BTN.y, BTN.y + BTN.h);
      const inParty = !!(me && me.party);
      switch (this.mode) {
        case 0:
          if (!inParty && within(lx, ly, 80, 195, 80, 100)) { this.mode = 2; api.pick(n => this.picked(n)); return true; }
          if (inParty && within(lx, ly, 80, 195, 100, 120)) { this.mode = 11; return true; }
          if (inParty && within(lx, ly, 80, 195, 120, 140)) { this.mode = 4; return true; }
          if (R) { g.close(32); return true; }
          return true;
        case 1:
          if (L) { api.send({ t: "partyaccept", r: 1 }); g.close(32); return true; }
          if (R) { api.send({ t: "partyaccept", r: 0 }); g.close(32); return true; }
          return true;
        case 2: if (R) { api.cancelPick(); this.mode = 0; } return true;
        case 3: if (R) { api.send({ t: "partyaccept", r: 2 }); g.close(32); } return true;
        case 11:
          if (L) { api.send({ t: "partyleave" }); this.mode = 5; return true; }
          if (R) { this.mode = 0; return true; }
          return true;
        case 5: return true;
        default: if (R) this.mode = 0; return true;
      }
    },
    onClose() { api.cancelPick(); },
    // el jugador elegido en el mundo (null = ninguno): POINT_COMMAND_HANDLER1 si no hay personaje
    picked(name) {
      const me = api.me();
      if (!name || name === me?.name) { this.mode = 0; api.log("A character for party member has not been selected. You can not join party."); return; }
      this.mode = 3; this.name = name;
      api.send({ t: "partyreq", name });
    },
  };
  gui.register(d);
  return {
    open() { d.mode = 0; gui.open(32); },
    reset() { if (d.mode === 2) d.mode = 0; },
    onEvent(ev, me) {
      if (ev.id !== me?.id) return;
      switch (ev.t) {
        case "partyquery":
          if (ev.from == null) { if (d.mode === 1) gui.close(32); break; }
          d.name = ev.from; d.show(1); break;
        case "party":
          if (ev.k === 1) d.show(ev.ok ? 8 : 9);
          else if (ev.k === 2) d.show(10);
          else if (ev.k === 4) { if (!ev.ok) d.show(9); else if (ev.name === me.name) d.show(8); else api.log(ev.name + " joined the party."); }
          else if (ev.k === 6) { if (ev.name === me.name) d.show(6); else api.log(ev.name + " withdrew from the party."); }
          else if (ev.k === 7) d.show(d.mode === 11 || d.mode === 5 ? 7 : 9);
          break;
        case "partychat": api.log("[Party] " + ev.name + ": " + ev.text, "party"); break;
      }
    },
  };
}

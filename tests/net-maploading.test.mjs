// Carga de mapas y reinicio del servidor en NetConnection: el login no espera las rejillas; un estado que cambia a un mapa
// sin rejilla espera a que llegue y conserva el orden; los mensajes de apagado/reinicio no son una expulsión.
import { NetConnection, SERVER_DOWN } from "../web/src/client/connection.js";
import { Grid } from "../web/src/shared/grid.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO " + m); } };
ok(SERVER_DOWN.test("El servidor se apaga."), "apaga");
ok(SERVER_DOWN.test("El servidor se reinicia. Vuelve a entrar en un minuto."), "reinicia");
ok(!SERVER_DOWN.test("Has entrado desde otro sitio."), "doble sesión sigue siendo expulsión");
const farm = new Grid(4, 4, new Uint8Array(16)), town = new Grid(4, 4, new Uint8Array(16));
let release; const gate = new Promise(r => release = r);
const maps = { aresden: { meta: { w: 4, h: 4 }, grid: null, ensure() { return this.loading ||= gate.then(() => { this.grid = town; return this; }); } } };
const c = new NetConnection(farm, {}, {}, maps);
c.pid = 1;
const seen = [];
c.onState = function (m) { seen.push(m.n); this.world.map = m.map || this.world.map; };
c.onMessage({ t: "s", n: 1 });                                                      // sin cambio de mapa: pasa directo
ok(seen.join() === "1", "estado normal inmediato");
c.onMessage({ t: "s", n: 2, map: { id: "aresden", kind: "town" } });               // rejilla sin bajar: espera
c.onMessage({ t: "s", n: 3 });                                                      // el siguiente se encola
ok(seen.join() === "1", "retenido hasta que llegue la rejilla");
release(); await new Promise(r => setTimeout(r, 20));
ok(seen.join() === "1,2,3", "orden conservado: " + seen.join());
ok(!c.stateQ && !c.stateWait, "cola vacía");
c.onMessage({ t: "s", n: 4, map: { id: "aresden-x", kind: "dungeon" } });          // las criptas no esperan nada
ok(seen.join() === "1,2,3,4", "cripta inmediata");
c.onMessage({ t: "kicked", msg: "El servidor se reinicia. Vuelve a entrar en un minuto." });
ok(c.serverDown && !c.kickMsg, "reinicio no es expulsión");
console.log(fallos ? "FALLO net-maploading" : "OK net-maploading"); process.exit(fallos ? 1 : 0);

// OPCIONES (F12), v0.85.76 (obs. 30): misma ventana del lienzo (window.js) que F1 y el menú automático: pestañas-botón, casillas, deslizadores y botones.
// Sustituye a la lista de filas Sí/No (ClassicDialog, v0.85.63). Mismas opciones: Juego / Sonido / Cuenta; api = {mods, setOpt, sys, setSys, logout}.
import { Win, THEME, Flow } from "./window.js";
import { getLang, setLang, t } from "./i18n.js";

export const OPT_ID = 60;
const tog = (k, n) => ({ n, get: api => !!api.mods()[k], set: (api, v) => api.setOpt(k, v) });
const GAME = [tog("autoAttack", "Ataque automático"), tog("run", "Correr"), tog("hpBars", "Barras de vida"), tog("groundInfo", "Info de objetos del suelo"), tog("groundCost", "Precio de objetos del suelo"),
  tog("statusPanel", "Panel de estados (DR/MR)"), tog("map", "Minimapa"), tog("grid", "Casillas bloqueadas"), tog("dirArrows", "Indicadores de dirección"), tog("questTrack", "Mini misión (rastreador)")];
const GFX = [{ n: "Remastered (apagado: Legacy)", get: api => api.mods().mode === "remastered", set: (api, v) => api.setOpt("mode", v ? "remastered" : "classic") }, tog("hdSprites", "Sprites y terreno HD")];
const SND = [{ n: "Sonido", get: api => api.sys().sound, set: (api, v) => api.setSys({ sound: v }) }, { n: "Música", get: api => api.sys().music, set: (api, v) => api.setSys({ music: v }) },
  { n: "Susurros", get: api => api.sys().whisper, set: (api, v) => api.setSys({ whisper: v }) }, { n: "Gritos", get: api => api.sys().shout, set: (api, v) => api.setSys({ shout: v }) }];

// v0.85.82 (obs. 41): mismo aspecto que la ventana F1 (newswin.js): título en negrita, pestañas-botón, secciones con cabecera y botones en fila (Flow);
// cada opción es un botón que se ilumina al estar activa, y la lista se desplaza dentro de la ventana.
export class OptWin extends Win {
  constructor(api) { super({ id: OPT_ID, title: "Opciones", w: 580, h: 530, x: 110, y: 8 }); this.api = api; this.tab = 0; }
  body(ui) {
    const I = this.inner, api = this.api, A = this.g.actions || {}, S = api.sys(), w = I.w;
    ui.text(I.x, I.y, t("Opciones del juego"), THEME.head, { bold: true, shadow: true });
    const ih = ui.para(I.x, I.y + 16, w, t("Pulsa un botón para activar o desactivar la opción: iluminado = activada."), THEME.txt);
    const ty = I.y + 20 + ih;
    ["Juego", "Sonido", "Cuenta"].forEach((n, i) => ui.btn(I.x + i * 104, ty, 100, n, () => { this.tab = i; this.blur(); }, { active: this.tab === i }));
    const sy = ty + 28, sh = I.y + I.h - sy;
    ui.scroll("opt" + this.tab, I.x, sy, w, sh, (u, cw) => {
      let y = 0;
      const sec = (title, fn) => { u.head(0, y, t(title)); y += 16; const f = new Flow(u, 0, y, cw, { rh: 26 }); fn(f); y = f.bottom + 8; };
      const checks = list => f => list.forEach(o => f.btn(t(o.n), () => o.set(api, !o.get(api)), { active: !!o.get(api) }));
      if (this.tab === 0) { sec("Juego", checks(GAME)); sec("Gráficos", checks(GFX)); }
      else if (this.tab === 1) {
        sec("Sonido y chat", checks(SND));
        const vol = (k, n) => { u.text(4, y + 2, t(n), THEME.txt); u.slider(190, y, cw - 260, S[k], 0, 100, v => api.setSys({ [k]: Math.round(v) }), { step: 5 }); u.text(cw - 44, y + 2, S[k] + "%", THEME.txt); y += 26; };
        vol("soundVol", "Volumen del sonido"); vol("musicVol", "Volumen de la música");
      } else {
        sec("Partida", f => {
          f.btn(getLang() === "es" ? "Idioma: Español" : "Language: English", () => setLang(getLang() === "es" ? "en" : "es"));
          f.btn("Guardar ahora", () => A.save?.()); f.btn("Repetir tutorial", () => A.tutorial?.()); f.nl();
          f.btn("Exportar copia", () => { if (A.canExport) A.exportSave?.(); }, { disabled: !A.canExport }); f.btn("Importar copia", () => A.importSave?.());
          f.btn("Menú clásico", () => this.g.toggle(19)); f.nl();
          f.btn(S.logoutCount === null ? "Cerrar sesión" : "Cancelar salida", () => api.logout(), { color: THEME.bad });
        });
      }
      return y;
    });
  }
}
export function registerOptions(gui, api) { const w = new OptWin(api); gui.register(w); return w; }

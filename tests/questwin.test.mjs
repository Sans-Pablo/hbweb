// Diario de misiones como ventana del lienzo (ticket 6): registro, apertura y lista. node tests/questwin.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../web/src/client/questwin.js", import.meta.url), "utf8");
assert.match(src, /export const QUEST_ID = 49/);
assert.match(src, /class QuestWin extends Win/);
assert.match(src, /export function registerQuests/);
const ui = readFileSync(new URL("../web/src/client/questui.js", import.meta.url), "utf8");
assert.match(ui, /createQuestUi\(getMe, openDiary\)/, "el rastreador solo abre el diario");
const dlg = readFileSync(new URL("../web/src/client/dialogs.js", import.meta.url), "utf8");
assert.ok(!/api\.quests/.test(dlg), "F5 ya no tiene botón de misiones");
const gui = readFileSync(new URL("../web/src/client/gui.js", import.meta.url), "utf8");
assert.match(gui, /onAction\?\.\("quests"\)/, "botón de la barra");
console.log("OK questwin");

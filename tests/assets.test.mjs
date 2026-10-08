import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { loadSpriteImage, validateDungeonAssets } from "../web/src/client/assets.js";
import { DUNGEON_ASSETS, DUNGEON_FLOOR_FRAMES } from "../web/src/shared/dungeon.js";
import { Renderer } from "../web/src/client/renderer.js";

const root = new URL("../web/data/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("sprites.json", root)));
const npcs = JSON.parse(readFileSync(new URL("npc.json", root)));

// Decodifica las hojas RGBA reales, incluidos los filtros PNG. Sin dependencias de navegador.
function png(name) {
  const b = readFileSync(new URL("sprites/" + name, root));
  assert.equal(b.readUInt32BE(0), 0x89504e47);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  assert.equal(b[24], 8); assert.equal(b[25], 6); assert.equal(b[28], 0);
  const chunks = [];
  for (let o = 8; o < b.length;) {
    const n = b.readUInt32BE(o);
    if (b.toString("ascii", o + 4, o + 8) === "IDAT") chunks.push(b.subarray(o + 8, o + 8 + n));
    o += n + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), out = Buffer.alloc(w * h * 4), stride = w * 4;
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const o = y * stride + x, a = x >= 4 ? out[o - 4] : 0, up = y ? out[o - stride] : 0, c = y && x >= 4 ? out[o - stride - 4] : 0;
      const v = filter === 1 ? a : filter === 2 ? up : filter === 3 ? Math.floor((a + up) / 2) : filter === 4 ? paeth(a, up, c) : 0;
      out[o] = raw[y * (stride + 1) + 1 + x] + v;
    }
  }
  return { w, h, rgba: out };
}

test("todas las hojas de la cripta existen y los fotogramas caben en el PNG", () => {
  validateDungeonAssets(manifest, npcs);
  for (const key of DUNGEON_ASSETS) {
    const im = png(manifest[key].png);
    for (const [x, y, w, h] of manifest[key].frames) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= im.w && y + h <= im.h, key);
      if (key.startsWith("ske")) {
        let visible = 0;
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (im.rgba[(j * im.w + i) * 4 + 3]) visible++;
        assert.ok(visible > 100, "esqueleto invisible: " + key);
      }
    }
  }
});

test("cada suelo elegido contiene piedra visible, no negro ni transparencia", () => {
  const im = png(manifest.t330.png);
  for (const f of DUNGEON_FLOOR_FRAMES) {
    const [x, y, w, h] = manifest.t330.frames[f]; let visible = 0, light = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const o = (j * im.w + i) * 4;
      if (im.rgba[o + 3] === 255) visible++;
      light += im.rgba[o] + im.rgba[o + 1] + im.rgba[o + 2];
    }
    assert.equal(visible, w * h); assert.ok(light / (w * h * 3) > 35, "suelo negro: " + f);
  }
});

test("manifiesto o NPC obsoleto produce un error explícito", () => {
  assert.throws(() => validateDungeonAssets(manifest, {}), /Skeleton/);
  const stale = { ...manifest }; delete stale.ske0;
  assert.throws(() => validateDungeonAssets(stale, npcs), /ske0/);
});

test("reintenta gráficos fallidos y rechaza después del segundo error", async () => {
  const original = globalThis.Image, urls = [];
  let fails = 1;
  globalThis.Image = class {
    set src(u) { urls.push(u); queueMicrotask(() => fails-- > 0 ? this.onerror() : this.onload()); }
  };
  try {
    await loadSpriteImage("ske0.png");
    assert.equal(urls.length, 2); assert.match(urls[1], /retry=1/);
    fails = 2;
    await assert.rejects(loadSpriteImage("t330.png"), /t330.png/);
  } finally { globalThis.Image = original; }
});

test("un bloque dibujado antes de que llegue su textura se vuelve a dibujar", () => {
  const original = globalThis.document;
  const ctx = new Proxy({}, { get: (t, k) => t[k] || (() => {}) });
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  let ready = false, draws = 0;
  const renderer = Object.create(Renderer.prototype);
  renderer.chunks = new Map(); renderer.grid = { tile: () => ({ spr: 330, frame: 1 }) };
  renderer.spr = { ready: () => ready, put: () => { if (ready) draws++; } };
  try {
    renderer.groundChunk(0, 0); assert.equal(renderer.chunks.size, 0);
    ready = true; renderer.groundChunk(0, 0);
    assert.equal(renderer.chunks.size, 1); assert.equal(draws, 256);
    renderer.groundChunk(0, 0); assert.equal(draws, 256);
  } finally { globalThis.document = original; }
});

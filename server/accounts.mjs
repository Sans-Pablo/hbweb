// Cuentas del servidor online: usuario + contraseña (scrypt con sal propia). Nada de contraseñas en claro, nunca.
// Limitador de intentos por dirección para frenar fuerza bruta y creación masiva de cuentas.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const scrypt = (pass, salt) => new Promise((res, rej) => crypto.scrypt(pass, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
export const cleanName = n => String(n ?? "").normalize("NFC").trim();
export const validName = n => /^[\p{L}\p{N}_-]{3,16}$/u.test(n);
export const validPass = p => typeof p === "string" && p.length >= 6 && p.length <= 64;

// escritura atómica: fichero temporal + renombrar (un corte de luz no deja el fichero a medias)
export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1));
  fs.renameSync(tmp, file);
}
export function readJson(file, dflt) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return dflt; } }

export class Accounts {
  // `store` (store.mjs) aporta el objeto de cuentas y el guardado; sin él, un JSON suelto (tests)
  constructor(file, store = null) { this.file = file; this.store = store; this.db = store ? store.accounts : readJson(file, {}); }
  save() { if (this.store) this.store.flush(); else writeJson(this.file, this.db); }
  has(name) { return !!this.db[name.toLowerCase()]; }
  get(name) { return this.db[name.toLowerCase()] || null; }
  async register(name, pass, ip = "") {
    name = cleanName(name);
    if (!validName(name)) return { err: "El usuario debe tener de 3 a 16 letras, números, _ o -." };
    if (!validPass(pass)) return { err: "La contraseña debe tener de 6 a 64 caracteres." };
    if (this.has(name)) return { err: "Ese usuario ya existe." };
    const salt = crypto.randomBytes(16);
    this.db[name.toLowerCase()] = { name, salt: salt.toString("hex"), hash: (await scrypt(pass, salt)).toString("hex"), created: Date.now(), ip };
    this.save();
    return { ok: true, name };
  }
  async verify(name, pass) {
    const a = this.get(cleanName(name));
    if (!a || typeof pass !== "string" || pass.length > 64) { await scrypt("x", Buffer.alloc(16)); return null; }      // mismo tiempo que un intento real
    const h = await scrypt(pass, Buffer.from(a.salt, "hex"));
    return crypto.timingSafeEqual(h, Buffer.from(a.hash, "hex")) ? a : null;
  }
}

// n intentos por ventana; al pasarse, bloqueo hasta que acabe la ventana
export class Limiter {
  constructor(max, windowMs) { this.max = max; this.win = windowMs; this.m = new Map(); }
  blocked(key, now = Date.now()) { const r = this.m.get(key); return !!r && r.until > now; }
  hit(key, now = Date.now()) {
    let r = this.m.get(key);
    if (!r || r.start + this.win < now) { r = { n: 0, start: now, until: 0 }; this.m.set(key, r); }
    if (++r.n > this.max) r.until = r.start + this.win;
    return r.n <= this.max;
  }
  clear(key) { this.m.delete(key); }
  sweep(now = Date.now()) { for (const [k, r] of this.m) if (r.start + this.win < now) this.m.delete(k); }
}

// Cuentas locales (la prueba es de un jugador y sin servidor): nombre + contraseña.
// La contraseña nunca se guarda: solo una huella PBKDF2 con sal, en este navegador.
const KEY = n => "hbweb.acc." + n.toLowerCase();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const unhex = s => new Uint8Array(s.match(/../g).map(h => parseInt(h, 16)));

async function derive(password, salt) {
  if (!globalThis.crypto?.subtle) throw new Error("Este navegador no permite crear cuentas (hace falta https o localhost).");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, k, 256));
}

const read = n => { try { return JSON.parse(localStorage.getItem(KEY(n)) || "null"); } catch { return null; } };
export const accountExists = n => !!read(n);
export const hasLegacySave = n => { try { return !!localStorage.getItem("hbweb.save." + n.toLowerCase()); } catch { return false; } };
export const listAccounts = () => {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("hbweb.acc.")) out.push(k.slice(10)); } } catch {}
  return out.sort();
};

export async function createAccount(name, password) {
  if (!/^[A-Za-z0-9_\-]{3,16}$/.test(name)) throw new Error("El nombre: 3 a 16 letras, números, _ o -.");
  if (password.length < 4) throw new Error("La contraseña necesita al menos 4 caracteres.");
  if (read(name)) throw new Error("Ese nombre ya existe en este navegador.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const acc = { name, salt: hex(salt), hash: await derive(password, salt), created: Date.now() };
  localStorage.setItem(KEY(name), JSON.stringify(acc));
  return acc;
}

export async function login(name, password) {
  const acc = read(name);
  if (!acc) throw new Error("No existe esa cuenta. Pulsa «Crear cuenta».");
  if ((await derive(password, unhex(acc.salt))) !== acc.hash) throw new Error("Contraseña incorrecta.");
  return acc;
}

// copia de seguridad: la partida de la cuenta en un archivo
export function exportSave(name) {
  const save = localStorage.getItem("hbweb.save." + name.toLowerCase());
  if (!save) return null;
  return JSON.stringify({ game: "hbweb", name, save: JSON.parse(save), at: new Date().toISOString() }, null, 1);
}
export function importSave(name, text) {
  const o = JSON.parse(text);
  if (o.game !== "hbweb" || !o.save || !o.save.stats) throw new Error("Ese archivo no es una partida de Helbreath Web.");
  localStorage.setItem("hbweb.save." + name.toLowerCase(), JSON.stringify(o.save));
}

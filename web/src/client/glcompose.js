// Compositor WebGL2 (0.83.0, tras ?gl=1). Sustituye a los lienzos temporales de Canvas2D en la composición de personajes y suelo:
// las hojas viven como texturas y el teñido (multiplicar ropa, sumar pelo, desplazamiento por canal de armas, tono del suelo)
// se hace en el shader, sin lecturas de GPU ni cambios de operación de composición. El resultado se vuelca con un drawImage
// (GPU→GPU) a los atlas de PersonCache y a los bloques de suelo, de modo que el resto del renderer 2D no cambia.
// 0.83.1: todos los quads de una composición van en un solo búfer y un solo drawArrays (modo, tinte, recorte y unidad de textura por vértice).
const NS = 8;                                       // hojas distintas por tanda (unidades de textura 0..7); dk/br del suelo en 8 y 9
const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; in vec4 aClamp; in vec3 aTint; in vec2 aMT;
uniform vec2 uView;
out vec2 vUv; flat out vec4 vC; flat out vec3 vT; flat out vec2 vMT;
void main() { vUv = aUv; vC = aClamp; vT = aTint; vMT = aMT; gl_Position = vec4(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0, 0.0, 1.0); }`;
// aMT = (modo, unidad de textura). modo: 0 normal · 1 multiplicar (tinte de ropa) · 2 sumar 0.55 (pelo, como PutSpriteRGB) · 3 desplazar canal (armas) · 4 solo tono (suelo: multiply + lighter)
const FS = `#version 300 es
precision highp float;
in vec2 vUv; flat in vec4 vC; flat in vec3 vT; flat in vec2 vMT; out vec4 o;
uniform sampler2D u0, u1, u2, u3, u4, u5, u6, u7, uDk, uBr; uniform vec2 uMap;
vec4 samp(int s, vec2 uv) {
  if (s < 4) { if (s == 0) return textureLod(u0, uv, 0.0); if (s == 1) return textureLod(u1, uv, 0.0); if (s == 2) return textureLod(u2, uv, 0.0); return textureLod(u3, uv, 0.0); }
  if (s == 4) return textureLod(u4, uv, 0.0); if (s == 5) return textureLod(u5, uv, 0.0); if (s == 6) return textureLod(u6, uv, 0.0); return textureLod(u7, uv, 0.0);
}
void main() {
  int mode = int(vMT.x + 0.5);
  vec4 c = samp(int(vMT.y + 0.5), clamp(vUv, vC.xy, vC.zw));
  if (mode == 1) c.rgb *= vT;
  else if (mode == 2) { float a = c.a; vec3 r = min(c.rgb + vT * 0.55, 1.0); float a2 = min(a + 0.55, 1.0); c = vec4(r * a, a2 * a); }
  else if (mode == 3 && c.a > 0.0) { vec3 u = clamp(c.rgb / c.a + vT, 0.0, 1.0); c.rgb = u * c.a; }
  else if (mode == 4) { vec2 m = vUv * uMap.x + uMap.y; c.rgb = min(c.rgb * textureLod(uDk, m, 0.0).rgb + 0.14 * textureLod(uBr, m, 0.0).rgb * c.a, c.a); }
  o = vec4(min(c.rgb, vec3(c.a)), c.a);                                                   // premultiplicado válido: con rgb>alfa el volcado a 2D sumaba luz (rectángulos pálidos)
}`;

const MAXPX = 1.6e9;                                  // tope de texturas vivas (bytes RGBA aprox.): alto a propósito para no expulsar/resubir hojas (0.83.1); si se supera, se expulsa la menos usada
const UPMS = 3;                                      // ms de subidas de textura por fotograma; el resto espera al siguiente (la composición se reintenta)
const MAXQ = 96, FL = 13;                             // quads por tanda y floats por vértice (pos2 uv2 clamp4 tint3 modo+unidad2)

export function hex3(s) { const n = parseInt(s.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

export class GLCompose {
  constructor() {
    this.cv = document.createElement("canvas"); this.cv.width = this.cv.height = 16;
    this.epoch = 0; this.lost = false; this.st = { up: 0, msUp: 0, draws: 0, quads: 0, defer: 0, lost: 0, bad: 0 };
    this.S = 1; this.w = this.h = 0;
    this.init();
    // Pérdida de contexto (GPU ocupada, cambio de pestaña, driver): todas las texturas mueren y un textura sin datos MUESTREA NEGRO OPACO (0,0,0,1),
    // lo que pintaba rectángulos negros en los personajes ya compuestos y en los siguientes. Se recrea todo y se invalida lo compuesto (epoch).
    this.cv.addEventListener("webglcontextlost", e => { e.preventDefault(); this.lost = true; this.st.lost++; this.nq = 0; });
    this.cv.addEventListener("webglcontextrestored", () => { try { this.init(); this.lost = false; this.epoch++; } catch (err) { console.warn("WebGL2: no se pudo restaurar", err); } });
  }

  init() {
    const gl = this.gl = this.cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("sin WebGL2");
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = this.p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.u = {}; for (const n of ["uView", "uMap"]) this.u[n] = gl.getUniformLocation(p, n);
    for (let i = 0; i < NS; i++) gl.uniform1i(gl.getUniformLocation(p, "u" + i), i);
    gl.uniform1i(gl.getUniformLocation(p, "uDk"), 8); gl.uniform1i(gl.getUniformLocation(p, "uBr"), 9);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.bufferData(gl.ARRAY_BUFFER, MAXQ * 6 * FL * 4, gl.DYNAMIC_DRAW);
    let off = 0;
    for (const [n, c] of [["aPos", 2], ["aUv", 2], ["aClamp", 4], ["aTint", 3], ["aMT", 2]]) {
      const l = gl.getAttribLocation(p, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, c, gl.FLOAT, false, FL * 4, off * 4); off += c;
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.tex = new Map(); this.px = 0; this.tick = 0; this.buf = new Float32Array(MAXQ * 6 * FL); this.nq = 0;
    this.slots = new Map(); this.upMs = 0; this.pending = new Set();
  }

  newFrame() { this.upMs = 0; }

  // lienzo de salida de w×h píxeles; el origen del mundo está en (ox, oy) y se pinta a escala S
  begin(w, h, S, ox, oy) {
    const { gl } = this;
    this.flush(); this.slots.clear();
    if (this.lost) return;
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.u.uView, w, h);
    this.S = S; this.ox = ox; this.oy = oy; this.w = w; this.h = h;
  }

  has(img) { return this.tex.has(img); }

  // Sube la hoja si hace falta. force=false respeta el presupuesto de ms por fotograma y devuelve null (la hoja queda en cola para pump()).
  texture(img, force = true) {
    const { gl } = this;
    if (this.lost) return null;
    let t = this.tex.get(img);
    if (t) { t.n = ++this.tick; return t; }
    if (!force && this.upMs > UPMS) { this.pending.add(img); this.st.defer++; return null; }
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h || img.complete === false) { this.st.bad++; return null; }       // sin datos aún: NO se sube (una textura vacía se muestrea negra y quedaría cacheada); la composición se reintenta
    const T0 = performance.now();
    gl.activeTexture(gl.TEXTURE0 + 10);                                         // unidad de subida: no pisa las de la tanda
    const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { gl.deleteTexture(tx); this.st.bad++; return null; }
    if (gl.isContextLost()) return null;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t = { tx, w, h, n: ++this.tick }; this.tex.set(img, t); this.px += w * h * 4; this.pending.delete(img);
    const dt = performance.now() - T0; this.upMs += dt; this.st.up++; this.st.msUp += dt;
    if (this.px > MAXPX) this.evict(t);
    return t;
  }

  // Sube hojas pendientes con el tiempo sobrante del fotograma
  pump(ms) {
    if (this.upMs > UPMS / 2) return;                                             // el fotograma ya subió lo suyo: el resto, en otro
    const t0 = performance.now();
    for (const img of this.pending) {
      if (performance.now() - t0 > ms) break;
      if (!(img.naturalWidth || img.width)) { this.pending.delete(img); continue; }
      this.texture(img, true);
    }
  }

  evict(keep) {
    const { gl } = this;
    this.flush();                                                                 // las unidades de la tanda en curso no pueden apuntar a hojas borradas
    for (const [img, t] of [...this.tex].sort((a, b) => a[1].n - b[1].n)) {
      if (this.px <= MAXPX * 0.8) break;
      if (t === keep) continue;
      gl.deleteTexture(t.tx); this.tex.delete(img); this.px -= t.w * t.h * 4;
    }
    this.slots.clear();
  }

  emit(x0, y0, x1, y1, u0, v0, u1, v1, cx0, cy0, cx1, cy1, tint, mode, slot) {
    if (this.nq >= MAXQ) this.flush();
    const b = this.buf, o = this.nq++ * 6 * FL;
    const r = tint ? tint[0] : 1, g = tint ? tint[1] : 1, bl = tint ? tint[2] : 1;
    const V = [[x0, y0, u0, v0], [x1, y0, u1, v0], [x0, y1, u0, v1], [x1, y0, u1, v0], [x0, y1, u0, v1], [x1, y1, u1, v1]];
    for (let i = 0; i < 6; i++) {
      const j = o + i * FL, v = V[i];
      b[j] = v[0]; b[j + 1] = v[1]; b[j + 2] = v[2]; b[j + 3] = v[3];
      b[j + 4] = cx0; b[j + 5] = cy0; b[j + 6] = cx1; b[j + 7] = cy1;
      b[j + 8] = r; b[j + 9] = g; b[j + 10] = bl; b[j + 11] = mode; b[j + 12] = slot;
    }
  }

  // Dibuja de una vez todos los quads acumulados (una composición entera = un drawArrays)
  flush() {
    if (!this.nq) return;
    const { gl } = this;
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf, 0, this.nq * 6 * FL);
    gl.drawArrays(gl.TRIANGLES, 0, this.nq * 6);
    this.st.draws++; this.st.quads += this.nq; this.nq = 0;
  }

  // Ajuste de tono del suelo (equivale a blendTone en Canvas2D: multiplicar por dk y sumar 0.14·br, recortado al alfa del bloque).
  // src: lienzo del bloque (P×P); dk/br: mapas de factores M×M (1 px por casilla con 1 de margen); N: casillas del bloque. Deja el resultado en this.cv.
  tone(src, dk, br, N, M) {
    const { gl } = this, T0 = performance.now(), P = src.width;
    const mk = (img, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit); const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tx;
    };
    const tdk = mk(dk, 8), tbr = mk(br, 9);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const tsrc = mk(src, 0);
    this.begin(P, P, 1, 0, 0);
    gl.uniform2f(this.u.uMap, N / M, 1 / M);
    this.emit(0, 0, P, P, 0, 0, 1, 1, 0, 0, 1, 1, null, 4, 0);
    this.flush();
    gl.deleteTexture(tsrc); gl.deleteTexture(tdk); gl.deleteTexture(tbr);
    this.slots.clear();
    this.st.msTone = (this.st.msTone || 0) + performance.now() - T0; this.st.tone = (this.st.tone || 0) + 1;
  }

  // Fotograma (sx,sy,w,h en píxeles de hoja) en (x,y) de mundo, tamaño dw×dh de mundo. mode/tint: ver el shader.
  // false si la hoja aún no está subida y el presupuesto del fotograma se agotó (el llamador reintenta la composición).
  quad(img, sx, sy, sw, sh, x, y, dw, dh, mode = 0, tint = null) {
    const { gl, S } = this, t = this.texture(img, false);
    if (!t) return false;
    let slot = this.slots.get(t);
    if (slot === undefined) {
      if (this.slots.size >= NS) { this.flush(); this.slots.clear(); }
      slot = this.slots.size; this.slots.set(t, slot);
      gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, t.tx);
    }
    const u0 = sx / t.w, v0 = sy / t.h, u1 = (sx + sw) / t.w, v1 = (sy + sh) / t.h, hx = 0.5 / t.w, hy = 0.5 / t.h;   // sin sangrado de casillas vecinas de la hoja
    this.emit((this.ox + x) * S, (this.oy + y) * S, (this.ox + x + dw) * S, (this.oy + y + dh) * S, u0, v0, u1, v1, u0 + hx, v0 + hy, u1 - hx, v1 - hy, tint, mode, slot);
    return true;
  }
}

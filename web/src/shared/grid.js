// Rejilla del mapa: casillas bloqueadas (del .amd) y ocupación por personajes.
import { DX, DY } from "./const.js";

export class Grid {
  // bytes: cuerpo del .amd (10 bytes por casilla, fila a fila)
  constructor(w, h, bytes) {
    this.w = w;
    this.h = h;
    this.dv = new DataView(bytes.buffer || bytes, bytes.byteOffset || 0);
    this.occ = new Map();                      // índice de casilla -> id de entidad
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  idx(x, y) { return y * this.w + x; }
  tile(x, y) {
    if (!this.inside(x, y)) return null;
    const o = this.idx(x, y) * 10, dv = this.dv, f = dv.getUint8(o + 8);
    return {
      spr: dv.getInt16(o, true), frame: dv.getInt16(o + 2, true),
      obj: dv.getInt16(o + 4, true), objFrame: dv.getInt16(o + 6, true),
      blocked: (f & 0x80) !== 0, teleport: (f & 0x40) !== 0,
    };
  }
  blocked(x, y) {
    if (!this.inside(x, y)) return true;
    return (this.dv.getUint8(this.idx(x, y) * 10 + 8) & 0x80) !== 0;
  }
  occupant(x, y) { return this.occ.get(this.idx(x, y)); }
  free(x, y, self) {
    if (this.blocked(x, y)) return false;
    const o = this.occ.get(this.idx(x, y));
    return o === undefined || o === self;
  }
  occupy(x, y, id) { this.occ.set(this.idx(x, y), id); }
  release(x, y, id) { if (this.occ.get(this.idx(x, y)) === id) this.occ.delete(this.idx(x, y)); }
  step(x, y, d) { return [x + DX[d], y + DY[d]]; }
}

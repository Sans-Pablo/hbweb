# Fidelidad v0.85.98

- **#92** renderer.js: foes en mapas PvP llevan fx38 (fotogramas 0-4, aditivo) como DrawObjectFOE (Game.cpp:17850).
- **#87** audio.js `MOB_SFX`/`mobSfx`: sonidos por tipo (MapData.cpp, frame==1); bundles.js los precarga.
- **#73** spellfx.js: el efecto 160 lanza rayos 16 en píxeles (v1=1); vuelan hacia el destino en píxeles y terminan con fx18+5×fx9 (Game.cpp:14230, 14636).
- **#66** sin cambio: attackMs = 8*78 + nib*12*8 igual que MapData.cpp; HG.cpp:6223 no limita.

Test: tests/fidelidad-v85-98.test.mjs. No verificado: aspecto visual y audio en navegador.

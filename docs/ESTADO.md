# Estado del proyecto

**Hecho:** granja de Aresden jugable; combate con fórmulas del servidor original; ítems originales (568 de Item.cfg), mochila de 50 casillas, peso, equipar con requisitos, absorción por parte del cuerpo, durabilidad (solo con bando), botín con las tasas originales (1/1), habilidades con maestría, resistencia, hambre; opciones (Esc), mapa tipo Diablo II, correr con R, guardado en el navegador.

**Pendiente (por orden):** magia (Magic.cfg), resto de monstruos y mapas, portales, NPC y tiendas, reparación, atributos raros de ítems, arco y flechas, grupos y PvP. Gráficos y música congelados hasta que todo sea fiel.

Especificaciones en `docs/` (items_spec.md). Pruebas: `node tests/sim.test.mjs`, `node tests/net-walk.test.mjs`.

## Atributos de los drops (revisado contra NpcDeadItemGenerator / _AdjustRareItemValue / bEquipItemHandler)
- Tablas de drop (oro 60 %, estándar 1d12000, genLevel de armas/varitas/armaduras) comprobadas: coinciden. Corregido: en diciembre cualquier monstruo suelta caramelos (el original lo escribe `type == 61 || 55`, siempre cierto).
- Nuevo `shared/attributes.js`: tipo/valor principal y secundario, color, tope 7 para monstruos de nivel ≤2, mínimos por tipo; peso/velocidad/durabilidad reales; efectos al equipar (dado +1/+2, acierto, defensa, recuperación de vida/aguante/maná, absorción, daño de combo, experiencia, oro, maná por daño, carga de crítico, bonus de lanzamiento de varitas).
- No portado aún: veneno (tipo 2), daño crítico (1, necesita ataque especial), "Righteous" (solo PvP), resistencias a veneno y magia (necesitan veneno y magia de NPC).

## Cuentas y guardado (prueba local)
- Pantalla de login con «Entrar» / «Crear cuenta» (`client/accounts.js`): contraseña con PBKDF2 + sal en localStorage; una partida previa con el mismo nombre se conserva al crear la cuenta.
- Guardado automático cada 10 s, al ocultar/cerrar la pestaña y desde Opciones («Guardar ahora»); copia de seguridad en archivo (exportar/importar) y cerrar sesión.
- Limitación: todo vive en el navegador (no hay sincronización entre dispositivos; haría falta un servidor).

# Dónde está el Helbreath original

En este PC: `C:\Users\sansp\Documents\HelbreathOriginal` (Git Bash: `/c/Users/sansp/Documents/HelbreathOriginal`). Es la especificación; antes de inventar nada se busca aquí.
(`/root/HelbreathServer` de otros documentos es la ruta de otra máquina; aquí no existe.)

| Qué | Ruta (bajo `HelbreathOriginal`) |
|---|---|
| Cliente (Game.cpp, Game.h…) | `Helbreath.Client/Helbreath.Client/` |
| Servidor de juego (combate, magia, NPC) | `Helbreath.HGServerConsole/Helbreath.HGServerConsole/` (`HG.cpp`, `char/combat.cpp`, `char/Client.cpp`, `CombatConfig.h`, `DropConfig.cpp`) |
| Login | `Helbreath.LoginServerConsole/` |
| Configuración (Item/Magic/NPC/Skill/BuildItem/CraftItem .cfg) | `Helbreath.ServerFiles/Config/` |

Búsquedas útiles: `grep -rn "SuperAttack\|bIsDash" --include=*.cpp --include=*.h .` (crítico y dash: `char/combat.cpp`, `Client.h`, `Game.cpp`).

**Pendiente de revisar contra esta fuente:** comportamiento de magos/invocadores a distancia (ver `ESTADO.md`).

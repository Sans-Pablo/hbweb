# Party (grupos)

Código: `shared/systems/party.js` (reglas), `client/party.js` (diálogo 32), órdenes `partyreq`/`partyaccept`/`partyleave` en `world.js`, chat `$` en `say`. Test: `tests/party.test.mjs`.
Original: `Client/Game.cpp` (DlgBoxClick_Party, DrawDialogBox_Party, DEF_NOTIFY_PARTY) y `HGServer/Game.cpp` (JoinPartyHandler, RequestAcceptJoinPartyHandler, PartyOperationResult_*, GetExp).

- Invitar: Character > Party > «Join a party», clic en el personaje. El invitado ve «offered you to join the party» (Yes/No); quien invita puede cancelar.
- Si el invitado no tenía grupo, lo funda; entra quien invitó. Máximo 8. Mismo bando; no se invita a quien espera respuesta.
- Retirarse: «Withdraw». Con un solo miembro el grupo se disuelve.
- Experiencia: `shareExp` reparte entre miembros vivos del mismo mapa; con 8 el doble por la división entera del original.
- Chat: `$texto` (3 SP) solo para el grupo. Nombre: «, Party Member».
- Estado: `p.party = { id, names }` (no se guarda). El registro vive en `Adventure.partyReg` (cruza mapas).
- Diferencias: la lista se lee de `p.party.names` (no hay petición `list`); no hay fuego amigo porque PvP no existe todavía; la invitación a alguien con otra pendiente se rechaza.

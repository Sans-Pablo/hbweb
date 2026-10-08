# Helbreath items / equipment / drops / stamina: implementation spec

Source: `/root/HelbreathServer`. Citation shorthand:
- `S:N` = `HGServer/Game.cpp` line N. `SH:` = `HGServer/Game.h`. `IH:` = `HGServer/Item.h`. `CLH:` = `HGServer/Client.h`.
- `C:N` = `Client/Game.cpp` line N. `CM:N` = `Client/MapData.cpp`. `CS:` = `Client/SpriteID.h`.
- `iDice(n,r)` = sum of n rolls of `rand()%r + 1`, and returns 0 when r<=0 (S: `CGame::iDice`). All integer division truncates (C semantics).

Items are loaded by the gate/login server, which concatenates `Files/Item.cfg`, `Item2.cfg` and `Item3.cfg` (ids are unique across the three files). The decoder is `_bDecodeItemConfigFileContents`, S:7906-8270.

---
## 1. Item.cfg format

A line reads `Item = <id> <name> <24 numeric fields>`. Tokens are separated by `= \t\n`, and parsing stops at `[ENDITEMLIST]` (S:8239-8250). Your column order is **confirmed** (S:7925-8230):

| # | field | member | notes |
|---|---|---|---|
| 1 | id | m_sIDnum | index into m_pItemConfigList[5000] (SH:61) |
| 2 | name | m_cName | max 20 chars, used as the item's key everywhere (save files, stacking) |
| 3 | type | m_cItemType | IH: 0 NONE,1 EQUIP,2 APPLY,3 USE_DEPLETE,4 INSTALL,5 CONSUME(stackable),6 ARROW(stackable),7 EAT,8 USE_SKILL,9 USE_PERM,10 USE_SKILL_ENABLEDIALOGBOX,11 USE_DEPLETE_DEST,12 MATERIAL |
| 4 | equipPos | m_cEquipPos | 0 none,1 HEAD,2 BODY,3 ARMS,4 PANTS,5 LEGGINGS (the client calls it BOOTS),6 NECK,7 LHAND,8 RHAND,9 TWOHAND,10 RFINGER,11 LFINGER,12 BACK,13 RELEASEALL (the client calls it FULLBODY) (IH, Client/Item.h) |
| 5 | effectType | m_sItemEffectType | IH: 1 ATTACK, 2 DEFENSE, 3 ATTACK_ARROW (bow), 4 HP, 5 MP, 6 SP, 7 HPSTOCK (food), 8 GET, 9 STUDYSKILL, 10 SHOWLOCATION, 11 MAGIC (scrolls), 12 CHANGEATTR, 13 ATTACK_MANASAVE, 14 ADDEFFECT, 15 MAGICDAMAGESAVE, 17 DYE, 18 STUDYMAGIC, 19 ATTACK_MAXHPDOWN, 20 ATTACK_DEFENSE, 22 FIRMSTAMINAR, 23 LOTTERY, 24 ATTACK_SPECABLTY, 25 DEFENSE_SPECABLTY, 26 ALTERITEMDROP, 28 WARM, 31 SLATES, 32 ARMORDYE, 34 WEAPONDYE |
| 6-11 | v1..v6 | m_sItemEffectValue1..6 | meaning depends on effectType (see sections 3 and 6) |
| 12 | maxLifeSpan | m_wMaxLifeSpan | durability; m_wCurLifeSpan is set to max when the item is created (S:8301) |
| 13 | specialEffect | m_sSpecialEffect | special-ability id / MaxHPdown divisor / extra absorption (section 3) |
| 14 | sprite | m_sSprite | icon sprite set (section 12) |
| 15 | spriteFrame | m_sSpriteFrame | frame inside that set |
| 16 | price | m_wPrice=abs(v); m_bIsForSale = v>=0 | negative means not sold in shops (S:8106-8111) |
| 17 | weight | m_wWeight | in 1/100 "stone" (see below) |
| 18 | apprValue | m_cApprValue | appearance code. For weapons it also defines the weapon type `(sAppr2&0x0FF0)>>4`: 1..39 melee, >=40 bow (S:52385-52427) |
| 19 | speed | m_cSpeed | weapon attack-animation delay (see below) |
| 20 | levelLimit | m_sLevelLimit | equip requirement |
| 21 | gender | m_cGenderLimit | 0 any, 1 male, 2 female |
| 22 | seV1 | m_sSpecialEffectValue1 | the decoder error text calls it "SM_HitRatio" |
| 23 | seV2 | m_sSpecialEffectValue2 | the decoder error text calls it "L_HitRatio" |
| 24 | relatedSkill | m_sRelatedSkill | skill index (section 11); -1 = none |
| 25 | category | m_cCategory | see below |
| 26 | itemColor | m_cItemColor | tint index (0 = none) |

Example: `Item = 1 Dagger 1 8 1 1 5 0 1 4 0 300 0 1 0 25 200 1 0 0 0 0 -10 7 1 0` decodes as type EQUIP, RHAND, ATTACK, 1D5 (S/M) and 1D4 (L), durability 300, sprite 1 frame 0, price 25, weight 200, appr 1, speed 0, seV2=-10, skill 7 (Short-Sword), category 1.

**Weight units.** The stored value is in hundredths of a stone, so 200 means 2 stones.
- The client shows `m_wWeight/100` as "Stone" (C:34853-34855).
- Equip requires `weight(1) <= (Str+AngelicStr)*100` (S:12258), so the required Str is weight/100.
- Gold (id 90) weighs `weight*count/20` (S:41729-41740). Any weight <=0 becomes 1.

**Speed.**
- The server only uses speed when equipping RHAND or TWOHAND (S:12497-12527): `nib = max(0, m_cSpeed - (Str+AngelicStr)/13)`. It stores `nib` in `m_iStatus & 0x0F` and resets `m_iComboAttackCount` to 0. Releasing the RHAND weapon clears the nibble (S:15822-15825).
- The client reads the nibble of every player it draws. For actions ATTACK (3) and ATTACKMOVE (8), each frame lasts `m_stFrame[type][action].m_sFrameTime + nib*12` ms (CM:1807-1819).
- Player ATTACK frames: frame time `41/1.1` stored in a short (=37), m_sMaxFrame 7. ATTACKMOVE: frame time 38, m_sMaxFrame 12 (CM:30-35).
- So heavier/slower weapons only slow the animation. The client then sends the next attack message.
- The server's only rate check is `bCheckClientAttackFrequency`: two attack messages less than 450 ms apart (client timestamp) cause a disconnect for non-admins (S:45955-45985).
- The rare attribute type 5 lowers speed by 1 (S:40536-40540).

**levelLimit / gender.** These are checked on equip (section 2). A custom-made item (`m_dwAttribute & 1`) ignores levelLimit (S:12239-12240). Gender is tested against `m_sType`: types 1-3 are male, 4-6 female (S:12243-12256).

**seV1 / seV2.** For ordinary weapons and armor both values are **unused** in this source.
- The per-target hit modifiers they once fed are commented out (`v1.432`, S:31886-31889).
- The client never reads them either.
- The only live use is seV1 = special-ability duration in seconds for effect types 24/25 (`m_iSpecialAbilityLastSec`, S:32033, S:32298).
- Dagger's seV2=-10 and armor's -x/-x values have no effect here. Keep them as data only.

**Category.** Counts per value come from all three cfg files.

| category | contents |
|---|---|
| 1 | melee weapons (swords, axes, hammers) |
| 3 | bows |
| 4 | arrows |
| 5 | shields |
| 6 | armor, helms, hose |
| 8 | wands / staves |
| 11 | clothes (shirt, chemise, robes) |
| 12 | cape, shoes, boots |
| 13 | hero capes |
| 15 | costumes |
| 21 | potions and gold pockets |
| 31 | monster parts, food, tablets |
| 42 | manuals, scrolls, tickets, misc |
| 43 | fishing rod |
| 46 | necklaces and rings |

The code uses category in these places:
- Repair. Categories 1-10 can only be repaired by the blacksmith (NPC type 24). Categories 11-12 and 43-50 only by the shopkeeper (type 15). Anything else cannot be repaired (S:30963-31006).
- Selling. Categories 11-50 sell for price/2 per unit, and neutral players get half of that again (S:30475-30492).
- Dyes. DYE works on categories 11 and 12. ARMORDYE on 6, 13 and 15. WEAPONDYE on 1, 3 and 8 (S:36559-36600).

**ItemName.cfg** (`Helbreath/CONTENTS/ItemName.cfg`).
- Lines look like `Item=<InternalName>====...<Display Name>=`, tokenized on `=` and `\n` (C:21823-21875).
- Each pair becomes {m_cOriginName, m_cName}. There are at most 1000 entries (`DEF_MAXITEMNAMES`, Client/Game.h:91).
- `GetItemName` does an exact `strcmp` of the internal name and uses the display name if it finds one, otherwise the internal name (C:29260-29275).
- Attribute prefixes and suffixes (rare items) are then added from `m_dwAttribute`. Items are always keyed by internal name. The display name is cosmetic only.

---
## 2. Equipping (`bEquipItemHandler`, S:12225-12475; client mirror C:41102-41160)

The checks run in this order. Any failure returns FALSE and does not equip.
1. The item exists, its type is EQUIP (1), and `m_wCurLifeSpan != 0` (S:12233-12237).
2. If the item is not custom-made, `m_sLevelLimit <= m_iLevel` (S:12239).
3. Gender, as described in section 1 (S:12243).
4. `iGetItemWeight(item,1) <= (Str+AngelicStr)*100` (S:12258). The client pre-check is `m_wWeight/100 > Str+AngelicStr` → refuse (C:41113). It uses integer division, so it is slightly more lenient than the server.
5. For equipPos HEAD, BODY, ARMS or LEGGINGS, v4 selects a stat requirement and v5 is the minimum value: 10 Str (+angelic), 11 Dex (+angelic), 12 Vit, 13 Int (+angelic), 14 Mag (+angelic), 15 Chr (S:12260-12310, IH comment). On failure the handler sends ITEMRELEASED and releases **whatever is currently equipped in that slot**. This is a quirk.
6. Special cases: item 845 (TWOHAND) needs Int>=65. Items 865/866 (RHAND) grant magic 94 when Int>99 and Mag>99.
7. If the new item has effect 24 or 25 and a special-ability item is already equipped in a different slot, that other item is released (S:12333-12343).
8. `equipPos==NONE` → FALSE (S:12346).

Slot conflicts. The old item is released with `ReleaseItemHandler(old,FALSE)` and **stays in the bag**, just unequipped (S:12348-12395).
- TWOHAND: releases TWOHAND if one is equipped. Otherwise it releases both RHAND and LHAND.
- LHAND or RHAND: releases TWOHAND, then the same slot.
- RELEASEALL (13, robes/full body): releases 13, HEAD, BODY, ARMS, LEGGINGS, PANTS and BACK.
- HEAD, BODY, ARMS, LEGGINGS, PANTS or BACK: releases slot 13 if it is occupied.
- Every other slot: releases the item in the same slot.

After the checks pass:
- Set `m_sItemEquipmentStatus[pos]=idx` and `m_bIsItemEquipped[idx]=TRUE`.
- Pack the appearance and colour bits:

| slot | appearance bits | colour bits (m_iApprColor) |
|---|---|---|
| HEAD | sAppr3 bits 4-7 | bits 0-3 |
| PANTS | sAppr3 bits 8-11 | bits 8-11 |
| LEGGINGS | sAppr4 bits 12-15 | bits 4-7 |
| BODY | sAppr3 bits 12-15 (appr>=100 → appr-100, and sets sAppr4 |= 0x80) | bits 20-23 |
| ARMS | sAppr3 bits 0-3 | bits 12-15 |
| LHAND | sAppr2 bits 0-3 | bits 24-27 |
| RHAND / TWOHAND | sAppr2 bits 4-11, plus the speed nibble | bits 28-31 |
| BACK | sAppr4 bits 8-11 | bits 16-19 |

- Broadcast a motion event and call `CalcTotalItemEffect` (S:12397-12473).

On the client, the equip screen also releases conflicting slots locally (C:41140-41165).

---
## 3. CalcTotalItemEffect (S:31749-32345)

**Reset.** These values are reset first (S:31760-31835):
- Attack dice: SM and L throw/range/bonus = 0.
- `m_iHitRatio = 0`. **`m_iDefenseRatio = Dex*2`**. `m_iDamageAbsorption_Shield = 0`. `m_iDamageAbsorption_Armor[0..14] = 0`.
- Mana save, AddResistMagic, AddPhysical/MagicalDamage, all `m_iAdd*` bonuses, special ability and angelic stats.
- If both RHAND and TWOHAND are set, RHAND is dropped (S:31761-31770).

Non-equipped items: an ALTERITEMDROP (26) item with life>0 sets `m_iAlterItemDropIndex` (S:31838-31849).

Equipped items, by effect type:

**ATTACK (1) and the variants 13, 19, 20, 24** (S:31862-32030):
- `AttackDiceThrow_SM=v1, Range_SM=v2, Bonus_SM=v3, Throw_L=v4, Range_L=v5, Bonus_L=v6`.
- `m_iHitRatio += m_cSkillMastery[relatedSkill]`.
- `m_sUsingWeaponSkill = relatedSkill`.
- `(dwAttribute>>28)&0xF` is added to physical and magical damage.
- Variant extras:
  - 19: `m_iSideEffect_MaxHPdown = specialEffect`. Max HP becomes `maxHP - maxHP/sE` (S:39049).
  - 13: `ManaSave += v4`, capped at 80.
  - 20: `Armor[BODY] += specialEffect`.
  - 24: special ability = specialEffect, duration = seV1.

**ATTACK_ARROW (3, bows)** (S:32170-32194):
- If the player has an arrow item (first ARROW-type slot with count>0), the dice come from the **bow's** v1..v6. Otherwise all dice are 0.
- `m_iHitRatio += mastery[relatedSkill]`.
- The arrow's own effect values are not used.

**DEFENSE (2) and DEFENSE_SPECABLTY (25)** (S:32196-32300):
- `m_iDefenseRatio += v1`.
- If equipPos is LHAND (shield): `m_iDamageAbsorption_Shield = v1 - v1/3` (S:32275-32279). The shield's v1 counts both as defense and as about 2/3 of v1 absorption %. Its v2 is unused.
- Any other slot: `m_iDamageAbsorption_Armor[equipPos] += v2` (S:32281-32283).
- 25: special ability = specialEffect, duration = seV1.
- Example: PlateMail(M) `1 2 2 37 40 ...` gives DR+37 and Body absorption 40%. Hauberk(M) gives DR+8 and Arms 10%. ChainHose(M) gives DR+6 and Pants 10%. Shoes and LongBoots give DR+1 and LEGGINGS 1%.

**ADDEFFECT (14, rings/necklaces), keyed by v1** (S:32035-32160):

| v1 | effect |
|---|---|
| 1 | resist magic += v2 |
| 2 | mana save += v2 (cap 80) |
| 3 | phys dmg += v2 |
| 4 | defense ratio += v2 |
| 5 | lucky |
| 6 | magic dmg += v2 |
| 7-10 | absorb air/earth/fire/water += v2 |
| 11 | PR += v2 |
| 12 | hit ratio += v2 |
| 13-15, 30 | purity-based gems |
| 16-19 | angelic STR/DEX/INT/MAG = `((attr>>28)&0xF)+1` |

**MAGICDAMAGESAVE (15):** stores the item index (S:31858).

**Final step:** `m_iDefenseRatio += AngelicDex*2`. HP, MP and SP are clamped to their new maximums (S:32302-32306).

**Exotic `m_dwAttribute` bits (note only).**
- bit0: custom-made.
- bits 20-23 / 16-19: primary rare type / value. Examples: 7 adds dice range +1, 9 adds +2, 11 adds trans-mana, 12 adds charge-crit.
- bits 12-15 / 8-11: secondary type / value, each step worth x7 or x3: PR, AR, DR, HP/SP/MP regen %, MR, absorption, crit, exp, gold.
- bits 28-31: +damage, or the angelic level.

See S:31900-31990 and S:32212-32270. Custom-made items with SpecEffValue2 change min/max AP and DR (S:31893-31945, S:32199-32210).

### Physical hit on a player (iCalculateAttackEffect, S:52318+)

Attacker damage (player attacker):
- Bare hand: `1d((Str+aStr)/12)` for both SM and L. Hit ratio = `m_iHitRatio + mastery[5]` (S:52386-52392).
- Melee (weapon type 1..39): `dice(SM) + bonus`. Then `AP = (int)(AP + AP*((Str+aStr)/5)/100 + 0.5)`, the same for L (S:52394-52417).
- Bow (type >=40): `dice + bonus + 1d((Str+aStr)/20)` (S:52419-52430).
- Then `hit += 50`, AP minimum 1, plus `m_iAddAR`. If (Dex+aDex)>50, `hit += (Dex+aDex)-50` (S:52801-52805).
- Hit chance: `dest = (int)(hitRatio / targetDefenseRatio * 50)`, clamped to 15..99 (SH:150,154; S:52880-52889). The target's DR is halved when the attacker and target face the same direction (attack from behind).
- Then `AP += AddPhysicalDamage`. AP is halved for a "near" attack. If the target is a player, `AP -= 1d(TargetVit/10)-1` (S:52895-52912).
- The attack hits if `1d100 <= dest`. If the attacker has **hunger<=10 or SP<=0**, a hit is still cancelled 10% of the time: `iDice(1,10)==5` (S:52922-52925).

Absorption when the target is a player (S:52999-53075). It applies to `iAP_SM` only, because players are size S/M:
- Body part: `r=1d10000`.

| r range | part | absorption used |
|---|---|---|
| 1-4999 | 1 BODY | Armor[BODY] |
| 5000-7499 | 2 legs | Armor[PANTS]+Armor[LEGGINGS] |
| 7500-8999 | 3 ARMS | Armor[ARMS] |
| 9000-10000 | 4 HEAD | Armor[HEAD] |

- `absArmor = (int)(min(abs,80)/100 * AP_SM)`.
- Shield: if `Shield>0` and `1d100 <= mastery[11]` (Shield skill), then `absShield = (int)(min(Shield,80)/100 * AP_SM)`. This also gives the Shield skill SSN +1, and the shield loses 1 durability if the target's side != 0. At 0 durability the shield is unequipped.
- `AP_SM -= absArmor+absShield`. If the result is <=0 it becomes 1.
- The armor piece on the hit part loses durability (section 4). Legs try PANTS first, then LEGGINGS (S:53140-53170).
- Armor[BACK] (capes) and neck/rings are never read by hit location, so only their DR counts.

---
## 4. Durability (m_wCurLifeSpan)

**Weapon** (S:53593-53629). On every **successful** melee hit (not arrows, i.e. `bArrowUse != TRUE`), for the weapon in TWOHAND or else RHAND:
- If maxLifeSpan != 0: `off=1`. For melee weapon types, weather adds extra: status 1 adds +1 with chance 1/3, 2 adds 1d2 with chance 1/2, 3 adds 1d3 with chance 1/2.
- **Durability only decreases if the attacker's `m_cSide != 0`.** Travellers/neutrals (side 0) never wear items.
- `cur = max(0, cur-off)`. At 0 the server sends ITEMLIFESPANEND and calls `ReleaseItemHandler` (unequip).
- Item 231 gives no weapon SSN.

**Armor** (`bCalculateEnduranceDecrement`, S:52223-52316). The piece on the hit body part loses `iDownValue` if the target's side != 0:

| condition | iDownValue |
|---|---|
| default | 1 |
| PvP between different sides, attacker skill 10 (axe) | 3 |
| PvP between different sides, attacker skill 14 (hammer) | 20 |
| ...the same with hammers 761/843/745 | 30 |
| ...the same with hammer 762 | 35 |
| target has special ability 52 | 0 |

At <=0 the piece is set to 0 and released. A hammer can also strip armor: release it if `cur < iDice(6 or 4, max-cur)` after hammer-specific scaling (S:52275-52313).

**At 0:** the item cannot be equipped (S:12237; client message "exhausted, fix it", C:41108). It stays in the bag.

**USE_SKILL items** (fishing rod etc.): -1 per use when max != 0 (S:27520-27530).

**Repair** (S:30952-31121). The NPC must match the category (section 1).
- Price: `cur==0 ? price/2 : price/2 - (short)((cur/max)*0.5*price)`.
- Paying sets `cur = max`, deducts the gold, and adds it to city funds.

---
## 5. Weight, inventory, stacking

- Total load: `sum(iGetItemWeight(item, item.m_dwCount))` over all 50 slots, **including equipped items** (S:31125-31155). For non-stackables count=1. Note that iGetItemWeight multiplies by count, so a non-stack item always has count 1.
- Max load: `(Str+AngelicStr)*500 + Level*500` (S:24901-24906). The client shows `total/100 / ((Str+aStr)*5 + Level*5)` (C:31849).
- When overweight: you **cannot pick up** an item if `cur + weight(item, count if CONSUME/ARROW else 1) > max` (S:12182-12189). You cannot buy or withdraw from the bank under the same rule (S:5544, S:6086, S:24011, S:39023). Being over the limit has **no movement or speed penalty** anywhere in the source.
- `DEF_MAXITEMS = 50` slots (CLH:25). If no slot is free, `_bAddClientItemList` fails. Picking up then puts the item back on the tile and sends `DEF_NOTIFY_CANNOTCARRYMOREITEM` (S:12122-12135).
- Stacking: **only type CONSUME (5) and ARROW (6)** merge, by exact name match: `count += new.count` (S:12191-12203). Gold (90) is CONSUME.
  - Potions and food are type EAT (7), so **each potion uses its own slot** and is deleted whole when used (ItemDepleteHandler, S:26935-26965).
- Arrows: one is consumed per bow shot from the first ARROW slot with count>0. At 0 the stack is deleted (S:52835-52852).
- New item bag position: the server defaults to (40,30) (S:12210-12211). The client puts a newly obtained item at the position of the first same-named item it already has, otherwise (40,30) (C:37793-37815).

---
## 6. Using items (UseItemHandler, S:27038-27535)

Usable types are USE_DEPLETE(3), USE_PERM(9), ARROW(6), EAT(7), USE_SKILL(8) and USE_DEPLETE_DEST(11). For types 3 and 7 the item is **always consumed** after its effect (ItemDepleteHandler, S:27455), even if nothing happened (e.g. drinking at full HP).

Rolls use `iDice(v1,v2)+v3`. If the item has nonzero `SpecEffectValue1`, the roll uses SpecEffectValue1-3 instead.

| effect | action |
|---|---|
| 4 HP | if HP<max: HP += roll, clamp to max. RedPotion(91) 2d12+10, BigRedPotion(92) 3d8+40 |
| 5 MP | MP += roll. BluePotion(93) 2d12+10, BigBlue(94) 4d8+50 |
| 6 SP | SP += roll **and cures poison**. GreenPotion(95) 2d12+10, BigGreen(96) 4d8+50 (S:27180-27225) |
| 7 HPSTOCK (food: Baguette 2d8+10, Meat 4d8+10, Fish...) | `m_iHPstock += roll` (cap 500) and **separately** `hunger += another roll`, clamped 0..100 (S:27228-27247). HPstock is added to the next natural HP tick, then reset to 0 (S:51900-51918) |
| 9 STUDYSKILL (manuals, DilutionPotion) | learn skill v1 at level v2 (or SpecEff1) via TrainSkillResponse |
| 18 STUDYMAGIC | learn magic v1 |
| 11 MAGIC (scrolls) | see below |
| 22 FIRMSTAMINAR | `m_iTimeLeft_FirmStaminar += v1`, cap 600. It decrements once per second (S:3892). While >0, running and shouting cost no SP |
| 12 CHANGEATTR | v1: 1 hair colour+1 (wraps at 16), 2 hair style+1 (wraps at 8), 3 skin+1 (wraps 1..3), 4 sex change (only if no clothes) |
| 28 WARM | thaw ice |
| 31 SLATES | buffs |
| 23 LOTTERY | does nothing |

MAGIC scrolls (effect 11), keyed by v1:

| v1 | effect |
|---|---|
| 1 | Recall (teleport "1   ") |
| 2 | invisibility (magic 32) |
| 3 | detect invisibility (magic 34, not in fight zones) |
| 4 | ticket. v2: 1 to bisle, 2 lottery, 11-19 fightzone(v2-10) on the right date/hour |
| 5 | summon (magic 31, v2) |

Using any MAGIC item cancels the user's own invisibility.

Other types:
- USE_DEPLETE_DEST(11): `_bDepleteDestTypeItemUseEffect`, consumed on success (dyes, seeds etc.).
- ARROW: selects the arrow slot.
- USE_PERM(9): Map (SHOWLOCATION) sends the current map id.
- USE_SKILL(8): starts a delayed skill. Durability -1, delay = Skill.m_sValue2 seconds (S:27505-27532).

---
## 7. Drops

### 7a. On death: NpcDeadItemGenerator (S:47297-48092)

It is called from the NPC-killed handler right after death (S:10760), unless the map type is NOPENALTY_NOREWARD.

Preconditions:
- No drop if the killer is not a player, the NPC is summoned or unsummoned, or the NPC type is 21 (guard), 34 (dummy) or 64 (crop).

**Rates** come from `GameConfigs/Settings.cfg`, parsed at S:5015-5050 and S:5220:
- `primary-drop-rate`: the code comment default is 6500. **The shipped file sets 1.**
- `secondary-drop-rate`: comment default 9000. **Shipped value 1.**
- `rep-drop-modifier = 5`.
- There is no initializer for these in the constructor. The parse check tests string length, not the value.

**Algorithm:**
1. If `iDice(1,10000) >= Primary`, a drop happens (35% with 6500; always with 1). Otherwise nothing drops.
2. If `iDice(1,10000) <= 6000`: **Gold** (id 90).
   - `count = iDice(1, GoldMax-GoldMin) + GoldMin`. These are NPC.cfg columns 7 and 8, e.g. Slime 120-220 (S:16062-16081).
   - Then `count += count*AddGold/100`.
3. Else let `t = Secondary - clamp(killer.m_iRating*RepDropModifier, -1000, 1000)`.
   - If `iDice(1,10000) <= t`, roll a **standard** drop with `r = 1d12000`:

| r range | item |
|---|---|
| 1-3000 | GreenPotion 95 |
| 3001-4000 | RedPotion 91 |
| 4001-5500 | BluePotion 93 |
| 5501-7000 | BigGreen 96 |
| 7001-8500 | BigRed 92 |
| 8501-9200 | BigBlue 94 |
| 9201-9800 | 1d6 of {390 PowerGreenPotion, 95, 780 RedCandy, 781 BlueCandy, 782 GreenCandy, 970 CritCandy} |
| 9801-10000 | 1d10 of {391 SuperPowerGreen, 650 ZemstoneOfSacrifice, 656 Xelima, 657 Merien, 95, 868/869/870/871 AncientTablets, 1d5 of {651 GreenBall, 652 RedBall, 653 YellowBall, 654 BlueBall, 655 PearlBall}} |
| 10001-12000 | December only: 1d3 of {780, 781, 782}. Otherwise no valid id (the original leaves iItemID uninitialized, so treat it as no drop). The type check `==61 || 55` is always true |

4. Otherwise: **valuable** drop by genLevel (NPC type):

| genLevel | NPC types |
|---|---|
| 1 | 10 Slime, 16 Giant-Ant, 22 Amphis, 55 Rabbit, 56 Cat |
| 2 | 11 Skeleton, 14 Orc/Orc-Mage, 17 Scorpion, 18 Zombie |
| 3 | 12 Stone-Golem, 23 Clay-Golem |
| 4 | 27 Hellbound, 61 Rudolph |
| 5 | 13 Cyclops, 28 Troll, 53 Beholder, 60 Cannibal-Plant, 62 DireBoar, 72 Claw-Turtle, 74 Giant-Crayfish, 76 Giant-Plant |
| 6 | 29 Ogre, 33 WereWolf, 48 Stalker, 54 Dark-Elf, 65 Ice-Golem, 78 Minotaurus |
| 7 | 30 Liche, 63 Frost, 70 Balrog, 71 Centaurus, 79 Nizie |
| 8 | 31 Demon, 32 Unicorn, 49 Hellclaw, 50 Tigerworm, 52 Gargoyle |
| 9 | 58 MountainGiant |
| 10 | 59 Ettin, 75 Lizards, 77 MasterMage-Orc |

Any other type → no drop. (iGenLevel is uninitialized in the source; port it as 0, meaning no drop.)

   - With 60% (`1d10000<=6000`) it is a **weapon**: 80% melee, 20% wand (code `<=8000`; the comment says 70/30).
   - Otherwise (40%) it is **armor or shield**.

Melee weapon tables (one uniform pick per genLevel):

| genLevel | item ids |
|---|---|
| 1 | {1 Dagger, 8 ShortSword, 59 LightAxe} |
| 2 | {12 MainGauche, 15 Gradius, 65 SexonAxe, 62 Tomahoc, 23 Sabre, 31 Esterk} |
| 3 | {50 GreatSword, 68 DoubleAxe, 23, 31} |
| 4 | {25 Scimitar, 28 Falchion, 31, 34 Rapier, 71 WarAxe} |
| 5 | {31, 34, 72 WarAxe+1, 844 BlackShadowSword} |
| 6 | {47 Claymore+1, 51 GreatSword+1, 55 Flameberge+1, 34, 74 GoldenAxe, 848 HolyBlade, 924 MageSword} |
| 7 | {47, 50, 54, 74, 850 KlonessAxe, 923 BMageSword} |
| 8 | {50, 560 BattleAxe, 615 GiantSword, 56 Flameberge+2, 846 The_Devastator} |
| 9 | {55, 615, 761 BattleHammer, 762 GiantBattleHammer, 857 IMC Manual} |
| 10 | {50, 51, 55, 56, 615, 761, 762, 843 BarbarianHammer, 853 ESW Manual} |

Wand table: genLevel 2-3 → 258, 4-6 → 257, 7-8 → 256. genLevel 1, 9 and 10 → no valid id.

Armor and shield tables (S:47614-47730):

| genLevel | item ids |
|---|---|
| 1-2 | {79 WoodShield, 81 TargeShield} |
| 3 | {85 LagiShield, 454 Hauberk(M), 472 Hauberk(W), 461 ChainHose(M), 482 ChainHose(W)} |
| 4 | {454, 472, 461, 482, 86 KnightShield} |
| 5 | {455 LeatherArmor(M), 475 LeatherArmor(W), 87 TowerShield, 454, 472, 461, 482} |
| 6 | 1d6: {456/476 ChainMail M/W, 458/478 PlateMail M/W, 87, one of 750-757 (horned/wings helm, wizard cap/hat, M/W), 454/472, 461/482} |
| 7 | 1d6: {1d6 of {457/477 ScaleMail, 454/472, 461/482}, 458/478, 86, 87, 600/602 Helm, 601/603 FullHelm} |
| 8 | {402 Cape, 451 LongBoots, 926 ShieldOfFaith, 927 ShieldOfBrave} |
| 9 | {402, 451} |
| 10 | 1d4: {457, 477, (3 → none), 600}. Case 5 (602) can never be rolled |

Valuable drops also get random rare attributes:
- ATTACK items, primary rare: type table on 1d10000 → colour. The value uses the 1d30000 tiered table, with minimums per type, capped at 7 if genLevel<=2.
- With 40% chance they also get a secondary attribute.
- Mana-save and defense items have analogous tables (S:47770-48066). Then `_AdjustRareItemValue` is applied (S:40523).

Placement: `bSetItem(npc.x, npc.y)` on the NPC's own tile, plus a broadcast of `DEF_COMMONTYPE_ITEMDROP` (S:48080-48088).

### 7b. On corpse removal: DeleteNpc body parts (S:26399-26760)

When `now - deadTime > NPC regenTime` (S:53885), a non-summoned NPC rolls a type-specific "alchemy part" (S:26460-26630). Examples:
- Slime: 1/25 SlimeJelly 220.
- Orc: 1d4 picks among {1/11 Meat 206, 1/20 Leather 207, 1/21 Teeth 208, rare table}.
- Amphis: 188-191. Ant: 192-193. Cyclops: 194-198. Hellbound: 199-204. Ogre: 209-214. Scorpion: 215-218. Troll: 222-225. Demon: 540-543. Unicorn: 544-547. Werewolf: 548-554.

Other branches call `bGetItemNameWhenDeleteNpc` (S:53889-54160), the rare jewelry/weapon table:
- Hellclaw (49) and Tigerworm (50) always roll their own 1d20000 / 1d10000 tables.
- Other types first need a 1/45 gate and then a per-type 1/N gate (e.g. Skeleton 1/465, Cyclops 1/85), then pick from a per-type list.

Wyverns (66, 73) and type 81 drop 5-15 / 12-20 items spread around them. In all cases there is an extra 9/100000 chance of an AncientTablet 868-871. Port these tables verbatim from those lines.

### 7c. Ground

- Each tile holds up to **12 items** (`DEF_TILE_PER_ITEMS`, Tile.h:15) as a LIFO stack.
- `bSetItem` pushes onto index 0. When full, the **oldest (index 11) is deleted** (Map.cpp:360-380).
- Clients only see the top item's sprite, frame and colour (S:2435-2445).
- There is **no ground lifetime or decay timer** anywhere in the source. Items persist until picked up or pushed off a full stack.

---
## 8. Pickup / drop rules

**Pickup** (`iClientMotion_GetItem_Handler`, S:12020-12160; motion DEF_OBJECTGETITEM):
- Requires a valid dir, the player alive, and `(sX,sY)==player position` (own tile only, S:12038).
- Takes only the **top** item (`pGetItem`, Map.cpp:383-412).
- On success: send ITEMOBTAINED and broadcast `COMMONTYPE_SETITEM` with the new top sprite (0 if empty).
- On failure (weight or slots): put the item back on the tile and send CANNOTCARRYMOREITEM.

**Drop** (`DropItemHandler`, S:11908-12010):
- Not allowed during a server change, for admins with admin-security on, or before init completes.
- The name must match the slot.
- Items always go onto the **player's own tile**.
- CONSUME/ARROW with `amount < count`: split a new item of `amount`. amount -1 means all.
- Otherwise: unequip if equipped, then move the whole item to the ground. An expired ALTERITEMDROP item is deleted instead.
- Broadcasts ITEMDROP and recalculates weight.

The client sends a drop when an item is dragged out of the bag onto the map. Inside the bag it only sends SETITEMPOS (section 12).

---
## 9. Stamina and hunger

- **Max SP** = `2*(Str+AngelicStr) + 2*Level` (S:39068-39077, client C:17974). It does not include AddSP.
- Related: MaxHP = `Vit*3 + Level*2 + (Str+aStr)/2`, minus `/MaxHPdown` (S:39043-39055). MaxMP = `2*(Mag+aMag) + 2*Level + (Int+aInt)/2` (S:39057-39066).
- **Running:** each run step (cMoveType==1) costs 1 SP if SP>0 and FirmStaminar==0. The server echoes the cost byte in MOVE_CONFIRM and the client subtracts it (S:1273-1285, C:30174-30177).
  - With SP 0 the server still lets the step through at 0 cost.
  - The client turns RUN into MOVE when `m_iSP < 1` (C:31498). Dash attacks (ATTACKMOVE) also require SP>0 on the client (C:30606ff).
- **Attacking costs no SP.** SP<=0 or hunger<=10 makes 10% of hits fail (S:52925) and 10% of spells fail (S:17193). The client shows magic probability x0.9 when SP<1 (C:33713).
- Shouting / global chat costs 3 or 5 SP (S:8914-8920, S:9033-9040).
- **Regen** is driven by CheckClientResponseTime, called every ~1000 ms (S:46107):
  - `plus = (30 - hunger)*1000` ms when hunger is 0..30, otherwise 0.
  - SP every `10000+plus` ms (SH:63), HP every `15000+plus` (SH:65), MP every `20000+plus` (SH:66) (S:3621-3643).
- **TimeStaminarPointsUp** (S:16569-16606):
  - Skipped if dead, hunger<=0, or skill 19 (pretend corpse) is active.
  - If SP<max: `t = 1d(Vit/3)`, plus `t*AddSP/100`, plus a level bonus: +15 if Level<=20, +10 if <=40, +5 if <=60. `SP = min(max, SP+t)`.
- HP tick: `t = max(1dVit, Vit/2)` (MaxHPdown applied), then `+HPstock`, then `+AddHP%`. MP tick: `1d(Mag+aMag)` + AddMP%.
- **Hunger** (0..100, starts at 100): `-1` every `DEF_HUNGERTIME = 60000` ms (SH:67), **only if Level >= DEF_LEVELLIMIT (20)** and the player is not an admin (S:3605-3614).
  - Effects: slower regen at <=30 (the formula above). No HP/MP/SP regen at all at 0. 10% hit and spell failure at <=10.
  - Restored by food (HPSTOCK). Set to 100 on respawn or resurrect (S:40895, S:45947).

---
## 10. New character

Creation is done by the world login server. **Only a binary exists**: `Files/WorldLServer.exe`, at .data strings 0x417ce8-0x418404 and code 0x4072xx-0x4078xx. The details below were decoded from its string table and x86. Treat them as high-confidence but not source-verified.

- Client creation rules: each stat 10..14, and the six stats must sum to 70 (C:13640-13645, C:22967, C:23081ff). Presets: Warrior Str14 Vit12 Dex14 Int10 Mag10 Chr10. Mage Mag14 Int14 Vit12, rest 10. Priest Str14 Mag12 Chr14, rest 10 (C:23195-23240).
- Character file: Level 1, Exp 0, Luck 10, `character-loc-map = default`, loc (-1,-1) (a random initial point is chosen on login), hunger 100 (the default).
  - The creation preview shows HP `Vit*3+2+Str/2`, MP `Mag*2+2+Int/2`, SP `Str*2+2` (C:22895-22903, WL code 0x40630e).
- **Items, in slot order** (format: `name count touchType tv1 tv2 tv3 color seV1 seV2 seV3 curLife attribute`):
  0 Dagger, 1 Map, 2 RedPotion, 3 BluePotion, 4 GreenPotion, 5 WoodShield, 6 KneeTrousers(M) if male or Chemise(W) if female.
  - Garment colour = `rand()%16`, but values {1,2,3,4,7,8,15} become 0.
  - `item-equip-status`: male `0000011…` (WoodShield and KneeTrousers equipped). Female `0000010…` (only WoodShield equipped; the Chemise is **not** equipped, as decoded).
- **Initial skill mastery** (WL loop over 60 skills, switch on index-3). All other skills are 0, and skill-SSN is all 0:

| skill | initial mastery |
|---|---|
| 3 Magic-Resistance | Mag/3 |
| 4 Magic | Mag+10 |
| 5 Hand-Attack | Str+10 |
| 6 Archery | 0 |
| 7 Short-Sword | Dex+10 |

  - Magic mastery is all 0.
  - Skills with mastery 0 **never gain SSN** (S:25037, S:25159), so those weapon skills must be learned by manual or trainer first.

---
## 11. Skills (Files/Skill.cfg; DEF_MAXSKILLTYPE 60)

0 Mining, 1 Fishing, 2 Farming, 3 Magic-Resistance, 4 Magic, 5 Hand-Attack, 6 Archery, 7 Short-Sword, 8 Long-Sword, 9 Fencing, 10 Axe-Attack, 11 Shield, 12 Alchemy, 13 Manufacturing, 14 Hammer, 19 Pretend-Corpse, 21 Staff-Attack, 23 Poison-Resistance (15-18, 20 and 22 are "????").

**SSN gain:**
- A weapon hit that does not kill gives +1 to the weapon's relatedSkill.
- A kill gives `1d(victim level)` for players or `1d(npc HitDice)` for NPCs, doubled if the attacker's HP<=3 (S:53598-53608, S:53217, S:53392).
- A bare-hand hit gives +1 to skill 5. A successful shield block gives +1 to skill 11.
- Note: weapon SSN is awarded in the same block as durability, i.e. on hit (S:53595-53637).

**Level up** (CalculateSSN_ItemIndex / _SkillIndex, S:25025-25260):
- `SSN += v`. If `mastery<100 && SSN > table[mastery+1]`, then `mastery++` and `SSN = 0`.
- `table[L] = L` for L<=50, otherwise `2L` (S:746, `_iCalcSkillSSNpoint`).
- Caps: if the new mastery exceeds the cap, the increase is undone and the old SSN restored.

| cap | skills |
|---|---|
| (Str+aStr)*2 | 0, 5, 13 |
| Level*2 | 3 |
| (Mag+aMag)*2 | 4, 21 |
| (Dex+aDex)*2 | 1, 6-11, plus 14 in the ItemIndex variant |
| (Int+aInt)*2 | 2, 12, 15, 19, plus 14 in the SkillIndex variant (inconsistency) |
| Vit*2 | 23 |

- When a level is gained and the skill is the equipped weapon's relatedSkill, `m_iHitRatio += 1`.
- Total mastery cap is 700 (`DEF_MAXSKILLPOINTS`, SH:86). Excess lowers the player-chosen "down skill" (by 1, or to 0 if it is <=20). If no down-skill is chosen, nothing is lowered (S: bCheckTotalSkillMasteryPoints).

---
## 12. Client inventory and sprites

**Sprite id bases** (CS:51-53): `ITEMGROUND = 100`, `ITEMEQUIP = 200`, `ITEMPACK = 300` (indices into m_pSprite).

**item-pack.pak** (20 image sets). `MakeSprite("item-pack", 301, 27)` puts pak set i at sprite 301+i (C:2964, C:2780-2793). Sets 17, 18 and 19 are then also loaded into 320, 321 and 322 (C:2967-2969).
- Bag icon = `m_pSprite[300 + m_sSprite]`, frame `m_sSpriteFrame`.
- So **pak set = m_sSprite-1** for m_sSprite 1..19. m_sSprite 20 → set 17, 21 → set 18, 22 → set 19 (angels).

**item-ground.pak** (20 sets). Loaded the same way into 101+i (C:2974). 120, 121 and 122 are overridden with sets 17, 18 and 19.
- Ground icon = `m_pSprite[100 + sprite]`, frame `spriteFrame`, drawn at the tile pixel (C:1952-1966).
- Colour tint: weapons and shields (sprites 1, 2, 3, 15) use the weapon palette m_wWR/WG/WB. Everything else uses m_wR/G/B.
- The mouse hover box is ±13 px.

**Bag** (`DrawDialogBox_Inventory`, C:18781-18830):
- Dialog sprite `DEF_SPRID_INTERFACE_ND_INVENTORY` frame 0.
- Each unequipped item is drawn at `(dlgX + 32 + item.x, dlgY + 44 + item.y)`. Disabled items are drawn translucent.
- CONSUME and ARROW items show their count at `(dlgX+39+x, dlgY+51+y)`.
- Equipped items are **not** drawn in the bag.
- Item x/y is per-slot and server-persisted (`m_ItemPosList`, `item-position-x/y` in the save file). It is clamped to `0<=x<=170`, `-10<=y<=95` (C:35995-36000, C:26603-26606).
- Drag/drop: `x = mouseX - dlgX - 32 - grabOffsetX`, the same for y. The client then sends `MSGID_REQUEST_SETITEMPOS`. Shift moves all items with the same name.
- Dropping an equipped item into the bag unequips it (C:36030-36045).
- Hit test uses the sprite's pixel collision.

**Equip screen** (`DrawDialogBox_Character`, C:31775+). Sprite = `m_pSprite[200 + m_sSprite (+40 if female)]`, frame `m_sSpriteFrame`.
- item-equipM.pak sets map to: 200+0 body (frame = playerType-1), 1 swords, 2 bows, 3 shields, 4 tunics, 5 shoes, 7←set6 berk, 8←7 hose, 9←8 body armor, 15←11 axes/hammers, 17←12 wands, 18←9 hair, 19←10 undies, 20←13 capes, 21←14 helms. Necks are 216 (item-pack set 15). Angels are 222 (item-pack set 19) (C:2988-3012).
- item-equipW.pak gives the same layout at +40: 240 body, 241, 242, 243, 245←4, 250←5, 251←6, 252←7, 253←8, 255←11, 257←12, 258 hair, 259 undies, 260 capes, 261 helm. 256 and 262 come from item-pack (C:3016-3040).
- Anchor offsets (male), relative to the dialog origin:

| slot(s) | offset |
|---|---|
| body layers (PANTS, ARMS, BOOTS, BODY, FULLBODY) and the base body/hair/undies | (171,290) |
| BACK | (41,137) |
| LHAND | (90,170) |
| RHAND / TWOHAND | (57,186) |
| NECK | (35,120) |
| RFINGER | (32,193) |
| LFINGER | (98,182) |
| HEAD | (72,135) |

- Female offsets: BACK (45,143), LHAND (84,175), R/TWOHAND (60,191), HEAD (72,139), others the same.
- Female draw order puts boots before or after pants depending on the skirt (pants sprite 12 frame 0).
- The world (on-map) look of equipment comes from apprValue bits (section 2), not from item sprites.

---
## Uncertainties / gotchas

1. **Starting items, equip flags and skill values** (section 10) come from disassembling WorldLServer.exe, not from source.
2. **Drop rates.** The shipped Settings.cfg (1/1) yields drops on every kill and almost always the "valuable" branch. The authentic intent is primary 6500 and secondary 9000 (per comments). Choose explicitly.
3. **Uninitialized variables in drops.** `iGenLevel` and some `iItemID` paths are uninitialized (wand for genLevel 1/9/10, standard case 9 outside December, armor genLevel 10 case 3). Treat them as "no drop".
4. **seV1/seV2.** They have no effect for normal weapons and armor in this codebase. Retail behaviour may have differed.
5. **No ground-item expiry** was found. Retail servers may have had one.
6. The armor stat-requirement failure releases the *currently equipped* item in that slot (quirk).
7. **Skill 14 (Hammer) cap** depends on Dex or Int depending on which SSN function fired.

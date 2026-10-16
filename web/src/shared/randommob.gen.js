// GENERADO por tools/convert_randommob.py desde HG.cpp:15997-16790 (MobGenerator aleatorio). No editar a mano.
export const MOB_TABLE = {"1":["Slime",10,5,1],"2":["Giant-Ant",16,10,2],"3":["Orc",14,15,1],"4":["Zombie",18,15,3],"5":["Skeleton",11,35,8],"6":["Orc-Mage",14,30,7],"7":["Scorpion",17,15,3],"8":["Stone-Golem",12,25,5],"9":["Cyclops",13,35,8],"10":["Amphis",22,20,3],"11":["Clay-Golem",23,20,5],"12":["Troll",28,25,3],"13":["Orge",29,25,1],"14":["Hellbound",27,25,8],"15":["Liche",30,30,8],"16":["Demon",31,20,8],"17":["Unicorn",32,35,7],"18":["WereWolf",33,25,1],"19":["YB-Aresden",1,15,1],"20":["YB-Elvine",1,15,1],"21":["Gagoyle",52,20,8],"22":["Beholder",53,20,5],"23":["Dark-Elf",54,20,3],"24":["Rabbit",55,5,1],"25":["Cat",56,10,2],"26":["Giant-Frog",57,10,2],"27":["Mountain-Giant",58,25,1],"28":["Ettin",59,20,8],"29":["Cannibal-Plant",60,20,5],"30":["Rudolph",61,20,5],"31":["Ice-Golem",65,35,8],"32":["DireBoar",62,20,5],"33":["Frost",63,30,8],"34":["Stalker",48,20,1],"35":["Hellclaw",49,20,1],"36":["Wyvern",66,20,10],"37":["Fire-Wyvern",73,20,10],"38":["Barlog",70,20,1],"39":["Tentocle",80,20,1],"40":["Centaurus",71,20,1],"41":["Giant-Lizard",75,20,1],"42":["Minotaurs",78,20,1],"43":["Tentocle",80,20,1],"44":["Claw-Turtle",72,20,1],"45":["Giant-Crayfish",74,20,1],"46":["Giant-Plant",76,20,1],"47":["MasterMage-Orc",77,20,1],"48":["Nizie",79,20,1],"49":["Tigerworm",50,20,1],"50":["Giant-Plant",76,20,1],"51":["Abaddon",81,20,10]};   // id -> [nombre, tipo, probSA, kindSA]
export const MOB_DEFAULT = ["Orc", 14, 15, 1];
export const MOB_COUNT = {"1":["d-1",5],"2":["d-1",5],"3":["d-1",5],"4":["d-1",3],"5":["d-1",3],"6":["d-1",3],"7":["d-1",3],"8":["d-1",2],"9":["d-1",2],"10":["d-1",5],"11":["d-1",3],"12":["d-1",5],"13":["d-1",3],"14":["d-1",3],"15":["d-1",3],"16":["d-1",2],"17":["d-1",2],"18":["d-1",5],"21":["d-1",2],"22":["d-1",2],"23":["d-1",5],"24":["d-1",2],"25":["d-1",2],"26":["d-1",4],"27":["d-1",2],"28":["d-1",3],"29":["d-1",3],"30":["d-1",3],"31":["d-1",5],"32":["d-1",3],"33":["d-1",3],"34":["n",1],"35":["n",1],"36":["n",1],"37":["n",1],"38":["n",1],"39":["n",1],"40":["n",1],"41":["n",1],"42":["d-1",3],"43":["n",1],"44":["d-1",3],"45":["n",1]};   // id -> ["d-1", N] = dice(1,N)-1 | ["n", N]; ausente = 0
export const GROUP_KEEP_1_IN_5 = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 24, 25, 26, 27, 28, 29, 30, 32, 33];     // con iTotalMob>=2 solo se conserva si dice(1,5)==1
export const GROUP_DROP_1_IN_5 = [9, 6, 14, 15, 16, 17, 18, 31, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48, 49];     // con iTotalMob>=2 se anula si dice(1,5)==1

// Nivel de mapa (m_cRandomMobGeneratorLevel) -> id de monstruo; `d(n)` = dice(1,n). Devuelve { id, berserk, firmSA }.
export function pickMob(level, d) {
  const o = { berserk: false, firmSA: 0 };
  let r = d(100);
    				switch (level) {
    				case 1:
    					if ((r >= 1) && (r < 20)) {
    						r = 1;  					}
    					else if ((r >= 20) && (r < 40)) {
    						r = 2;  
    					}
    					else if ((r >= 40) && (r < 85)) {
    						r = 24; 					}
    					else if ((r >= 85) && (r < 95)) {
    						r = 25; 
    					}
    					else if ((r >= 95) && (r <= 100)) {
    						r = 3;  					}
    
    					
    					break;
    
    				case 2:
    					if ((r >= 1) && (r < 40)) {
    						r = 1;
    					}
    					else if ((r >= 40) && (r < 80)) {
    						r = 2;
    					}
    					else r = 10;
    					
    					break;
    
    				case 3:     
    					if ((r >= 1) && (r < 20)) {
    						switch ( d(2) ) {
    						case 1: r = 3; break;
    						case 2: r = 4; break;
    						}
    					}
    					else if ((r >= 20) && (r < 25)) {
    						r = 30;  
    					}
    					else if ((r >= 25) && (r < 50)) {
    						switch ( d(3) ) {
    						case 1: r = 5; break;
    						case 2:	r = 6; break;
    						case 3: r = 7; break;
    						}
    					}
    					else if ((r >= 50) && (r < 75)) {
    
    						switch ( d(7) ) {
    						case 1: 
    						case 2: r = 8;  break;
    						case 3:	r = 11; break;
    						case 4:	r = 12; break;
    						case 5: r = 18; break;
    						case 6: r = 26; break;
    						case 7: r = 28; break;	
    						}
    					}
    					else if ((r >= 75) && (r <= 100)) {
    
    						switch ( d(5) ) {
    						case 1:
    						case 2:	r = 9;  break;
    						case 3:	r = 13; break;
    						case 4: r = 14; break;
    						case 5: r = 27; break;	
    						}
    					}
    					
    					break;
    
    				case 4:
    					if ((r >= 1) && (r < 50)) {
    						switch ( d(2) ) {
    						case 1:	r = 2; break;
    						case 2: r = 10; break;
    						}
    					}
    					else if ((r >= 50) && (r < 80)) {
    						switch ( d(2) ) {
    						case 1: r = 8; break;
    						case 2: r = 11; break;
    						}
    					}
    					else if ((r >= 80) && (r < 100)) {
    						switch ( d(2) ) {
    						case 1: r = 14; break;
    						case 2:	r = 9; break;
    						}
    					}
    					
    					break;
    
    				case 5:
    					if ((r >= 1) && (r < 30)) {
    						switch ( d(5) ) {
    						case 1:
    						case 2: 
    						case 3:
    						case 4: 
    						case 5: r = 2; break;
    						}
    					}
    					else if ((r >= 30) && (r < 60)) {
    						switch ( d(2) ) {
    						case 1: r = 3; break;
    						case 2: r = 4; break;
    						}
    					}
    					else if ((r >= 60) && (r < 80)) {
    						switch ( d(2) ) {
    						case 1: r = 5; break;
    						case 2: r = 7; break;
    						}
    					}
    					else if ((r >= 80) && (r < 95)) {
    						switch ( d(3) ) {
    						case 1:
    						case 2: r = 8;  break;
    						case 3:	r = 11; break;
    						}
    					}
    					else if ((r >= 95) && (r <= 100)) {
    						switch ( d(3) ) {
    						case 1: r = 11; break;
    						case 2: r = 14; break;
    						case 3: r = 9; break;
    						}
    					}
    					
    					break;
    
    				case 6: 
    					if ((r >= 1) && (r < 60)) {
    						switch ( d(4) ) {
    						case 1: r = 5; break;
    						case 2:	r = 6; break;
    						case 3: r = 7; break;
    						case 4: r = 4; break;
    						}
    					}
    					else if ((r >= 60) && (r < 90)) {
    						switch ( d(4) ) {
    						case 1:
    						case 2: r = 8;  break;
    						case 3:	r = 11; break;
    						case 4:	r = 12; break;
    						}
    					}
    					else if ((r >= 90) && (r <= 100)) {
    
    
    						switch ( d(7) ) {
    						case 1: r = 26; break;
    						case 2:	r = 9;  break;
    						case 3:	r = 13; break;
    						case 4: r = 14; break;
    						case 5: r = 18; break;
    						case 6: r = 28; break;	
    						case 7: r = 27; break;	
    						}
    					}
    					
    					break;
    
    				case 7: 
    					if ((r >= 1) && (r < 50)) {
    						switch (d(5)) {
    						case 1: r = 3;  break; 
    						case 2: r = 6;  break; 
    						case 3: r = 10; break; 
    						case 4: r = 3;  break; 
    						case 5: r = 50; break; 
    						}
    					}
    					else if ((r >= 50) && (r < 60)) {
    						r = 30; 
    					}
    					else if ((r >= 60) && (r < 85)) {
    						switch (d(4)) {
    						case 1: r = 50; break; 
    						case 2: 
    						case 3: r = 6;  break; 
    						case 4: r = 12; break; 
    						}
    					}
    					else if ((r >= 85) && (r <= 100)) {
    						switch (d(3)) {
    						case 1: r = 12;  break; 
    						case 2:
    						case 3:
    						if (d(100) < 3) 
    							r = 17; 
    						else r = 12; 
    						break;
    						}
    					}
    					
    					break;
    
    				case 8:
    					if ((r >= 1) && (r < 70)) {
    						switch ( d(2) ) {
    						case 1:	r = 4;  break;
    						case 2: r = 5;  break;
    						}
    					}
    					else if ((r >= 70) && (r < 90)) {
    						switch ( d(3) ) {
    						case 1: r = 8;  break;
    						case 2: r = 11; break;
    						case 3: r = 14; break;
    						}
    					}
    					else if ((r >= 90) && (r < 100)) {
    						switch ( d(2) ) {
    						case 1: r = 9;  break;
    						case 2: r = 14; break;
    						}
    					}
    					
    					break;
    
    				case 9:
    					if ((r >= 1) && (r < 70)) {
    						switch ( d(2) ) {
    						case 1:	r = 4;  break;
    						case 2: r = 5;  break;
    						}
    					}
    					else if ((r >= 70) && (r < 95)) {
    						switch ( d(3) ) {
    						case 1: r = 8;  break;
    						case 2: r = 9;  break;
    						case 3: r = 13; break;
    						}
    					}
    					else if ((r >= 95) && (r < 100)) {
    						switch ( d(6) ) {
    						case 1:
    						case 2:
    						case 3: r = 9;  break;
    						case 4:
    						case 5: r = 14; break;
    						case 6: r = 15; break;
    						}
    					}
    
    
    					if ((d(3) == 1) && (r != 16)) o.berserk = true;
    
    					
    					break;
    
    				case 10:
    					if ((r >= 1) && (r < 70)) {
    						switch ( d(2) ) {
    						case 1:	r = 4; break;
    						case 2: r = 5; break;
    						}
    					}
    					else if ((r >= 70) && (r < 95)) {
    						
    						switch ( d(3) ) {
    						case 1:
    						case 2:	r = 13; break;
    						case 3: r = 14; break;
    						}
    					}
    					else if ((r >= 95) && (r < 100)) {
    						switch (d(3)) {
    						case 1:
    						case 2: r = 14; break;
    						case 3: r = 15; break;
    						}
    					}
    
    
    					if ((d(3) == 1) && (r != 16)) o.berserk = true;
    
    					
    					break;
    
    				case 11:
    					if ((r >= 1) && (r < 30)) {
    						switch ( d(5) ) {
    						case 1:
    						case 2: 
    						case 3:
    						case 4: 
    						case 5: r = 2; break;
    						}
    					}
    					else if ((r >= 30) && (r < 60)) {
    						switch ( d(2) ) {
    						case 1: r = 3; break;
    						case 2: r = 4; break;
    						}
    					}
    					else if ((r >= 60) && (r < 80)) {
    						switch ( d(2) ) {
    						case 1: r = 5; break;
    						case 2: r = 7; break;
    						}
    					}
    					else if ((r >= 80) && (r < 95)) {
    						switch ( d(3) ) {
    						case 1:
    						case 2: r = 10;  break;
    						case 3:	r = 11; break;
    						}
    					}
    					else if ((r >= 95) && (r <= 100)) {
    						switch ( d(3) ) {
    						case 1: r = 11; break;
    						case 2: r = 7; break;
    						case 3: r = 8; break;
    						}
    					}
    					
    					break;
    
    				case 12: 
    					if ((r >= 1) && (r < 50)) {
    						switch ( d(3) ) {
    						case 1:	r = 1 ; break;
    						case 2: r = 2 ; break;
    						case 3: r = 10; break;
    						}
    					}
    					else if ((r >= 50) && (r < 85)) {
    						switch ( d(2) ) {
    						case 1: r = 5; break;
    						case 2: r = 4; break;
    						}
    					}
    					else if ((r >= 85) && (r < 100)) {
    						switch ( d(3) ) {
    						case 1: r = 8; break;
    						case 2: r = 11; break;
    						case 3: r = 26; break;
    						}
    					}
    					
    					break;
    
    				case 13: 					
    					if ((r >= 1) && (r < 15)) {
    						r = 4;
    						o.berserk = true;
    						o.firmSA = 4 - (d(2)-1);
    					}
    					else if ((r >= 15) && (r < 40)) {
    						r = 14;
    						o.berserk = true;
    						o.firmSA = 4 - (d(2)-1);
    					}
    
    					else if ((r >= 40) && (r < 60)) {
    						r = 9;
    						o.berserk = true;
    						o.firmSA = 4 - (d(2)-1);
    					}
    					else if ((r >= 60) && (r < 75)) {
    						r = 13;
    						o.berserk = true;
    						o.firmSA = 4 - (d(2)-1);
    					}
    					else if ((r >= 75) && (r < 95)) {
    
    						r = 23;
    					}
    					else if ((r >= 95) && (r < 100)) {
    
    						r = 22;
    					}
    					
    					break;
    
    				case 14: 					
    					if ((r >= 1) && (r < 30)) {
    						r = 23;
    					}
    					else if ((r >= 30) && (r < 50)) {
    
    						r = 22;
    					}
    					else if ((r >= 50) && (r < 70)) {
    						r = 15;
    						o.berserk = true;
    						o.firmSA = 4 - (d(2)-1);
    					}
    					else if ((r >= 70) && (r < 90)) {
    						r = 16;
    					}
    					else if ((r >= 90) && (r < 100)) {
    
    						r = 21;
    					}
    					
    					break;
    
    				case 15: 
    					if ((r >= 1) && (r < 35)) {
    
    						r = 23;
    						o.berserk = true;
    					}
    					else if ((r >= 35) && (r < 50)) {
    
    						r = 22;
    						o.berserk = true;
    					}
    					else if ((r >= 50) && (r < 80)) {
    						r = 16;
    						o.berserk = true;
    					}
    					else if ((r >= 80) && (r < 100)) {
    
    						r = 21;
    					}
    					
    					break;
    				case 16: 
    					if ((r >= 1) && (r < 40)) {
    						switch ( d(3) ) {
    						case 1:	r = 1 ; break;
    						case 2: r = 2 ; break;
    						case 3: r = 10; break;
    						}
    					}
    					else if ((r >= 40) && (r < 50)) {
    						r = 30;
    					}
    					else if ((r >= 50) && (r < 85)) {
    						switch ( d(2) ) {
    						case 1: r = 5; break;
    						case 2: r = 4; break;
    						}
    					}
    					else if ((r >= 85) && (r < 100)) {
    						switch ( d(3) ) {
    						case 1: r = 8; break;
    						case 2: r = 11; break;
    						case 3: r = 26; break;
    						}
    					}
    					
    					break;
    				case 17:
    					if ((r >= 1) && (r < 30)) {
    						switch ( d(4) ) {
    						case 1:	r = 22 ; break;
    						case 2: r = 8; break;
    						case 3: r = 24 ; break;
    						case 4: r = 5; break;
    						}
    					}
    					else if ((r >= 30) && (r < 40)) {
    						r = 30;
    					}
    					else if ((r >= 40) && (r < 70)) {
    						r = 32;
    
    					}
    					else if ((r >= 70) && (r < 90)) {
    						r = 31;
    						if (d(5) == 1) o.berserk = true;
    					}
    					else if ((r >= 90) && (r <= 100)) {
    						r = 33;
    					}
    					
    					break;
    				case 18:
    					if ((r == 1) || (r == 2)) 
    					{	r = 35; 
    					}else if ((r > 2) && (r <= 12)) 
    					{	r = 48; 
    					}else if ((r > 12) && (r <= 50)) 
    					{	r = 44; 
    					}else if ((r > 50) && (r <= 85)) 
    					{	r = 45; 
    					}else if ((r > 85) && (r <= 95)) 
    					{	r = 34; 
    					}else if ((r > 95) && (r <= 100)) 
    					{	r = 26; 
    					}
    					break;
    
    				case 19: 
    					if ((r >= 1) && (r <= 15)) 
    					{	r = 40; 
    					}else if ((r > 15) && (r <= 25)) 
    					{	r = 42; 
    					}else if ((r > 25) && (r <= 35)) 
    					{	r = 21; 
    					}else if ((r > 35) && (r <= 60)) 
    					{	r = 43; 
    					}else if ((r > 60) && (r < 90)) 
    					{	r = 23; 
    					}else if ((r >= 90) && (r <= 100)) 
    					{	r = 22; 
    					}
    					break;
    
    				case 20: 
    					if (r == 1)  
    					{	r = 37; 
    					}else if ((r > 1) && (r <=3)) 
    					{	r = 36; 
    					}else if ((r > 3) && (r <= 8)) 
    					{	r = 49; 
    					}else if ((r == 9)) 
    					{	r = 38; 
    					}else if ((r > 9) && (r <= 20)) 
    					{	r = 21; 
    					}else if ((r > 20) && (r <= 35)) 
    					{	r = 16; 
    					}else if ((r > 35) && (r <= 45)) 
    					{	r = 40; 
    					}else if ((r > 45) && (r <= 55)) 
    					{	r = 41; 
    					}else if ((r > 55) && (r <= 75)) 
    					{	r = 28; 
    					}else if ((r > 75) && (r <= 95)) 
    					{	r = 43; 
    					}else if ((r > 95) && (r <= 100)) 
    					{	r = 22; 
    					}
    					break;
    
    				case 21: 
    					if ((r >= 1) && (r < 94)) 
    					{	r = 17; 
    						o.berserk = true;
    					}else if ((r >= 94) && (r < 95)) 
    					{	r = 36; 
    					}else if ((r >= 95) && (r < 96)) 
    					{	r = 37; 
    					}else if ((r >= 96) && (r < 97)) 
    					{	r = 47; 
    					}else if ((r >= 97) && (r < 98)) 
    					{	r = 35; 
    					}else if ((r >= 98) && (r < 99)) 
    					{	r = 49; 
    					}else if ((r >= 99) && (r <= 100)) 
    					{	r = 51; 
    					}
    					break;
    				}
    
  o.id = r;
  return o;
}

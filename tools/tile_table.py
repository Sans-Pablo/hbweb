"""Tabla de sprites de mapa del cliente (CGame::MakeTileSpr en Client/Game.cpp)."""
# (archivo .pak, índice inicial, cantidad)
TILE_PAKS = [
    ("maptiles1", 0, 32), ("Sinside1", 70, 27), ("Trees1", 100, 46), ("TreeShadows", 150, 46),
    ("objects1", 200, 10), ("objects2", 211, 5), ("objects3", 216, 4), ("objects4", 220, 2),
    ("Tile223-225", 223, 3), ("Tile226-229", 226, 4), ("objects5", 230, 9), ("objects6", 238, 4),
    ("objects7", 242, 7), ("maptiles2", 300, 15), ("maptiles4", 320, 10), ("maptiles5", 330, 19),
    ("maptiles6", 349, 4), ("maptiles353-361", 353, 9), ("Tile363-366", 363, 4), ("Tile367-367", 367, 1),
    ("Tile370-381", 370, 12), ("Tile382-387", 382, 6), ("Tile388-402", 388, 15), ("Tile403-405", 403, 3),
    ("Tile406-421", 406, 16), ("Tile422-429", 422, 8), ("Tile430-443", 430, 14), ("Tile444-444", 444, 1),
    ("Tile445-461", 445, 17), ("Tile462-473", 462, 12), ("Tile474-478", 474, 5), ("Tile479-488", 479, 10),
    ("Tile489-522", 489, 34), ("Tile523-530", 523, 8), ("Tile531-540", 531, 10), ("Tile541-545", 541, 5),
]
# casos sueltos: structures1 sprites 1 y 5 -> índices 51 y 55
EXTRA = {51: ("structures1", 1), 55: ("structures1", 5)}


def locate(idx):
    if idx in EXTRA:
        return EXTRA[idx]
    for name, start, count in TILE_PAKS:
        if start <= idx < start + count:
            return name, idx - start
    return None

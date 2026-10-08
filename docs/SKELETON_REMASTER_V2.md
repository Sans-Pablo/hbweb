# Esqueleto remaster: caminata v2

Se sustituyen en modo remastered las ocho hojas de caminata (ske8–ske15), con cuatro fotogramas por dirección, por el diseño revisado en el video. Las direcciones conservan el orden N, NE, E, SE, S, SO, O y NO y el ritmo de la simulación. El modo clásico usa las hojas originales; quieto, ataque, daño y muerte conservan sus animaciones anteriores.

Los atlas nuevos incluyen coordenadas y pivotes propios, a escala 4×, con pies y tamaño corporal ajustados al original. El cargador espera estas ocho hojas; si aún no están disponibles se usa conjuntamente imagen y geometría originales. Las sombras y destellos usan el mismo atlas que el cuerpo.

Pruebas: 32 fotogramas dentro de sus PNG RGBA, contenido visible, pivotes, fallback durante carga, cambio clásico/remastered y coherencia entre cuerpo y sombra. La vista dungeon-preview.html permite activar Caminata del esqueleto y elegir la dirección. Es una primera entrega jugable: habrá diferencias de diseño al pasar de caminar a las otras acciones hasta que se redibujen también.

Empaquetado: tools/pack_skeleton_remaster.py acepta un JSON con las ocho hojas de origen en orden y solo recorta/escala/empaqueta los sprites revisados. No cambia la simulación, colisiones o cámara.

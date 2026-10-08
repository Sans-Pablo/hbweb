# Subir a GitHub y publicar (una sola vez)

1. En github.com crea un repositorio **vacío** (sin README), por ejemplo `hbweb`. Para Pages gratis tiene que ser público.
2. Crea la carpeta `.github\workflows` dentro de `hbweb` y mueve ahí el archivo `pages.yml` (está en la raíz de `hbweb`).
   (Yo no puedo escribir en esa carpeta, por eso viene aparte.)
3. En esta carpeta abre una terminal y ejecuta (cambia TU_USUARIO):

       git init -b main
       git add .
       git commit -m "Primera versión"
       git remote add origin https://github.com/TU_USUARIO/hbweb.git
       git push -u origin main

4. En el repositorio: Settings -> Pages -> Source: **GitHub Actions**.
5. Espera 1-2 minutos (pestaña Actions). La prueba queda en:

       https://TU_USUARIO.github.io/hbweb/

Cada vez que haga cambios, repite `git add . && git commit -m "..." && git push` y la web se actualiza sola.
Cada tester guarda su progreso en su propio navegador.

# EVA · versión «gota»

Variante de la página de demostración de EVA en la que, al tocar la burbuja, la ventana del
chat cae como una gota: una gota baja desde lo alto de la pantalla, salpica al llegar y la
ventana se abre desde el punto del impacto, como una onda en el agua.

Publicada en GitHub Pages: https://pablo11107.github.io/EVA-gota/ (marcada `noindex`, como la
original). La versión sin la gota sigue en [Pablo11107/EVA](https://github.com/Pablo11107/EVA),
sin cambios. Es el mismo bot y la misma página; solo cambia cómo se abre la ventana.

## Qué hay

| Archivo | Qué es |
|---|---|
| `gota/eva-gota.js` | La animación. Un archivo, sin dependencias |
| `index.html` | La página de EVA, con la gota conectada a la burbuja |
| `tests/test_gota.py` | Comprueba que la gota solo anima: sin red, sin datos, cargada con huella SRI |
| El resto | Igual que en el repositorio original (verificador, pruebas, flujo, librerías) |

## Cómo funciona

- No toca el bot ni lo que se envía. Anima la ventana de la burbuja (la parte `bot` que Typebot
  deja accesible) y una capa propia por encima de la página que se borra al terminar.
- Dura algo más de un segundo: la caída (0,4 a 0,7 s según la altura de la pantalla) y la
  apertura (0,76 s). Con la ventana ya abierta no se repite; si se cierra a medias, no deja rastro.
- Si el sistema pide reducir el movimiento, o el navegador no admite animaciones web, o una
  versión futura de la burbuja cambia por dentro, la ventana se abre como siempre.
- Se carga como las demás librerías: desde el propio servidor, con huella SRI en el importmap
  y autorizada por la CSP. `scripts/verificar.py` falla si el archivo cambia sin actualizar la huella.

## Llevarla a emalsa.es

Funciona igual con la nube de Typebot que con el servidor propio. Copiar `gota/eva-gota.js`
junto a `typebot-web.js` y añadir dos líneas al bloque de la burbuja:

```js
import Typebot from '/js/typebot-web.js'
import gota from '/js/eva-gota.js'

Typebot.initBubble({
  typebot: "eva",
  ...gota(),
  // apiHost, theme, previewMessage: como estaban
});
```

## Después de cambiar la gota

La huella SRI y la CSP dependen del contenido. Tras editar `gota/eva-gota.js`, actualizar la huella
de `"./gota/eva-gota.js"` en el importmap de `index.html` y después:

    python3 scripts/verificar.py --actualizar-csp
    python3 -m unittest discover -s tests -v

La huella se calcula con:

    openssl dgst -sha384 -binary gota/eva-gota.js | openssl base64 -A

"""La animación de la gota (gota/eva-gota.js) no puede cambiar lo que hace el bot.

    python3 -m unittest discover -s tests -v

Solo anima: no hace peticiones, no carga código, no lee ni escribe datos del
navegador y no pasa nada a Typebot salvo los avisos de apertura y cierre.
"""
import re
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "scripts"))
import verificar  # noqa: E402

GOTA = (RAIZ / "gota" / "eva-gota.js").read_text(encoding="utf-8")
HTML = (RAIZ / "index.html").read_text(encoding="utf-8")


class Gota(unittest.TestCase):
    def test_sin_red_ni_codigo_ni_datos(self):
        prohibido = ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "import(", "eval(",
                     "new Function", "localStorage", "sessionStorage", "indexedDB", "document.cookie",
                     "postMessage", "http:", "https:"]
        for texto in prohibido:
            self.assertNotIn(texto, GOTA.replace("http://www.w3.org/2000/svg", ""), texto)

    def test_solo_avisa_de_apertura_y_cierre(self):
        devuelto = re.search(r"return \{\n(.*?)\n  \};\n\}", GOTA, re.S).group(1)
        claves = set(re.findall(r"^    (\w+)\(", devuelto, re.M))
        self.assertEqual(claves, {"onOpen", "onClose"})

    def test_cargada_con_huella(self):
        self.assertIn("import gota from './gota/eva-gota.js'", HTML)
        self.assertIn('"./gota/eva-gota.js": "sha384-', HTML)
        self.assertIn("...gota(),", HTML)
        self.assertEqual(verificar.verificar_pagina(HTML), [])

    def test_huella_rota_bloqueada(self):
        html = re.sub(r'("\./gota/eva-gota\.js": "sha384-)[^"]+', r"\1AAAA", HTML)
        self.assertTrue(any("eva-gota.js no coincide" in e for e in verificar.verificar_pagina(html)))

    def test_respeta_reducir_movimiento(self):
        self.assertIn("prefers-reduced-motion: reduce", GOTA)


if __name__ == "__main__":
    unittest.main()

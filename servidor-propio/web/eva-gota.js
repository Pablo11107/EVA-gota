// La gota de EVA: al abrir la burbuja, una gota de agua cae desde lo alto de la
// pantalla y, al chocar, se derrama una lámina de agua transparente que llena la
// forma de la ventana, con su menisco, gotitas que salen despedidas y ondas que
// se van calmando. La ventana del chat aparece debajo del agua mientras se aclara.
//
// La gota y el agua se dibujan con WebGL, con la óptica de una gota real: es
// esférica (la forma de lágrima es de dibujo animado), transparente, invierte la
// luz como una lente (oscura arriba, clara abajo), tiene un brillo especular, una
// cáustica donde enfoca la luz y un borde oscuro por reflexión interna. Al caer
// se alarga por el desenfoque de movimiento, como en una foto.
//
// No toca el bot ni lo que se envía: solo anima la ventana de la burbuja (la
// parte «bot» que Typebot deja accesible) y una capa propia por encima de la
// página que se borra al terminar. Si no hay WebGL, la ventana se derrama sin la
// gota; si el sistema pide reducir el movimiento o la burbuja cambia por dentro,
// se abre como siempre.
//
// Uso, junto al resto de opciones de la burbuja (ver incrustar-eva.html):
//   import gota from '/js/eva-gota.js'
//   Typebot.initBubble({ typebot: "eva", apiHost: "…", ...gota(), theme: { … } })

const CAPA_Z = 424243;          // justo por encima de la burbuja de Typebot (424242)
const GRAVEDAD = 3400;          // px/s², a escala de pantalla
const RADIO_GOTA = 13;          // px
const EXTENDER = 0.7;           // s que tarda el agua en llenar la ventana
const EMERGER = [0.25, 0.85];   // s (desde el impacto) en que la ventana aparece bajo el agua
const CALMA = 1.5;              // s desde el impacto hasta que el agua queda quieta
const GOTITAS = 12;
const FRENTE = 18;              // px de ancho del borde de agua que avanza delante de la ventana

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function gota() {
  let abierta = false;
  let enCurso = null;
  let pintor;  // WebGL se prepara en un momento libre, no al tocar la burbuja

  const preparar = () => {
    if (pintor === undefined && !reducido()) pintor = crearPintor();
  };
  if (typeof window !== 'undefined') {
    (window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(preparar);
  }

  return {
    onOpen() {
      // Typebot.open() también llega aquí con la ventana ya abierta: entonces no se repite.
      if (abierta) return;
      abierta = true;
      if (reducido() || typeof Element.prototype.animate !== 'function') return;
      try {
        preparar();
        enCurso = derramar(pintor);
      } catch (error) {
        console.warn('La gota de EVA no se pudo animar:', error);
      }
    },
    onClose() {
      abierta = false;
      if (enCurso) enCurso();
      enCurso = null;
    },
  };
}

// ── La escena ───────────────────────────────────────────────────────────────

function derramar(pintor) {
  const ventana = document.querySelector('typebot-bubble')?.shadowRoot?.querySelector('[part="bot"]');
  const base = ventana?.offsetParent;
  if (!base) return null;

  // Cerrada, la ventana está escalada a cero; su posición y tamaño sin escalar
  // dicen dónde va a quedar.
  const marco = base.getBoundingClientRect();
  const caja = { x: marco.left + ventana.offsetLeft, y: marco.top + ventana.offsetTop,
                 ancho: ventana.offsetWidth, alto: ventana.offsetHeight };
  const esquina = parseFloat(getComputedStyle(ventana).borderTopLeftRadius) || 8;
  const impacto = { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto * 0.6 };
  const lejos = Math.max(...[[caja.x, caja.y], [caja.x + caja.ancho, caja.y], [caja.x, caja.y + caja.alto],
                             [caja.x + caja.ancho, caja.y + caja.alto]].map(([x, y]) => Math.hypot(x - impacto.x, y - impacto.y)));
  const radioFinal = (lejos + 14) / 0.985;

  // Caída libre desde encima de la pantalla. Sin WebGL no hay gota: el agua se derrama al momento.
  const salida = -RADIO_GOTA * 4;
  const caida = pintor ? Math.sqrt(2 * (impacto.y - salida) / GRAVEDAD) : 0;
  const total = caida + CALMA;

  // La ventana: sin el zoom de Typebot, oculta mientras cae la gota y se derrama el
  // agua, y apareciendo debajo de ella.
  const duracion = caida + EMERGER[1] + 0.05;
  const sujetar = ventana.animate([
    { offset: 0, transform: 'none', opacity: 0 },
    { offset: (caida + EMERGER[0]) / duracion, transform: 'none', opacity: 0, easing: 'ease-in-out' },
    { offset: (caida + EMERGER[1]) / duracion, transform: 'none', opacity: 1 },
    { offset: 1, transform: 'none', opacity: 1 },
  ], { duration: duracion * 1000 });

  const gotitas = Array.from({ length: GOTITAS }, (_, i) => ({
    angulo: (i / GOTITAS) * 2 * Math.PI + (Math.random() - 0.5) * 0.5,
    velocidad: 380 + Math.random() * 520,
    radio: 1.8 + Math.random() * 3.4,
  }));

  if (pintor) pintor.empezar(caja, esquina);
  const t0 = performance.now();
  let fotograma = 0;

  const paso = (ahora) => {
    const t = (ahora - t0) / 1000;
    const ti = t - caida;  // tiempo desde el impacto
    const escena = { impacto, ti, gota: null, gotitas: [], radio: 0, amplitud: 0, fin: 1 };

    if (ti < 0) {
      // Cayendo: la velocidad alarga la gota (desenfoque de movimiento).
      const v = GRAVEDAD * t;
      escena.gota = { x: impacto.x, y: salida + 0.5 * GRAVEDAD * t * t, radio: RADIO_GOTA,
                      estirar: 1 + Math.min(0.75, v / 2400) };
    } else {
      const p = Math.min(1, ti / EXTENDER);
      escena.radio = radioFinal * (1 - Math.pow(1 - p, 3));
      escena.amplitud = 0.1 * (1 - p) + 0.015;
      escena.fin = 1 - suave(CALMA - 0.35, CALMA, ti);
      for (const g of gotitas) {
        const recorrido = (g.velocidad / 7) * (1 - Math.exp(-7 * ti));
        const tragada = suave(recorrido + 4, recorrido + 30, escena.radio);  // el agua la alcanza y se la lleva
        const alfa = suave(0, 0.03, ti) * (1 - tragada) * escena.fin;
        if (alfa > 0.01) {
          escena.gotitas.push({ x: impacto.x + Math.cos(g.angulo) * recorrido,
                                y: impacto.y + Math.sin(g.angulo) * recorrido, radio: g.radio, alfa });
        }
      }
    }

    if (pintor) pintor.pintar(escena);
    if (t < total) fotograma = requestAnimationFrame(paso);
    else limpiar();
  };

  const limpiar = () => {
    cancelAnimationFrame(fotograma);
    sujetar.cancel();
    if (pintor) pintor.terminar();
  };
  fotograma = requestAnimationFrame(paso);
  return limpiar;
}

function suave(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ── WebGL ───────────────────────────────────────────────────────────────────

const VERTICES = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';

const FRAGMENTOS = `
precision highp float;
uniform vec2 uLienzo;      // px del lienzo
uniform float uDpr;
uniform vec4 uGota;        // x, y, radio, estiramiento (px CSS)
uniform float uHayGota;
uniform vec2 uImpacto;
uniform float uTi;         // s desde el impacto (negativo antes)
uniform float uRadio;
uniform float uAmplitud;
uniform vec4 uCaja;        // x, y, ancho, alto de la ventana
uniform float uEsquina;
uniform float uFin;        // 1 → 0 cuando el agua se calma
uniform vec4 uGotitas[${GOTITAS}];  // x, y, radio, alfa
const float FRENTE = ${FRENTE.toFixed(1)};
const vec3 LUZ = vec3(-0.42, -0.66, 0.62);

float ondulacion(float a, float t) {
  return 0.55 * sin(3.0 * a + 1.3 + 2.1 * t) + 0.30 * sin(5.0 * a + 4.1 - 3.3 * t)
       + 0.15 * sin(9.0 * a + 2.2 + 5.0 * t);
}

float cajaSd(vec2 p) {
  vec2 c = uCaja.xy + uCaja.zw * 0.5;
  vec2 q = abs(p - c) - uCaja.zw * 0.5 + uEsquina;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uEsquina;
}

// Distancia (negativa dentro) al borde del agua: un círculo que crece desde el impacto y ondula.
float frenteSd(vec2 p) {
  vec2 d = p - uImpacto;
  return length(d) - uRadio * (1.0 + uAmplitud * ondulacion(atan(d.y, d.x), uTi));
}

// Ondas del agua: tres trenes que salen del impacto y un oleaje fino en varias
// direcciones, que rompe la simetría de dibujo; todo se calma con el tiempo.
float ondas(vec2 p) {
  vec2 d = p - uImpacto;
  float dist = length(d);
  float calma = exp(-uTi * 2.4);
  float h = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float x = dist - 480.0 * max(uTi - 0.1 * fk, 0.0);
    h += exp(-x * x / (600.0 + 2200.0 * uTi)) * sin(x / (6.0 + 1.5 * fk)) * (1.0 - 0.25 * fk);
  }
  h += 0.22 * sin(dot(p, vec2(0.071, 0.052)) + 9.0 * uTi) + 0.18 * sin(dot(p, vec2(-0.043, 0.083)) - 7.0 * uTi)
     + 0.12 * sin(dot(p, vec2(0.11, -0.031)) + 12.0 * uTi);
  return h * calma;
}

// Distancia (negativa dentro) al agua: el frente ondulado, dentro de la forma de la ventana.
float aguaSd(vec2 p) { return max(frenteSd(p), cajaSd(p)); }

// Una gota vista de frente: esfera transparente que refracta, con brillo, cáustica y borde oscuro.
vec4 esfera(vec2 p, vec2 c, float r, float estirar) {
  vec2 q = (p - c) / r;
  q.y /= estirar;
  float d2 = dot(q, q);
  float px = 1.0 / (r * uDpr);
  if (d2 > (1.0 + 3.0 * px) * (1.0 + 3.0 * px)) return vec4(0.0);
  float d = sqrt(d2);
  float cubre = 1.0 - smoothstep(1.0 - 1.5 * px, 1.0 + 1.5 * px, d);
  float z = sqrt(max(0.0, 1.0 - min(d2, 1.0)));
  vec3 n = normalize(vec3(q, z + 0.0001));
  vec3 L = normalize(LUZ);
  // La gota es una lente: invierte lo que hay detrás, así que el cielo claro queda abajo.
  float cielo = smoothstep(-0.55, 0.95, q.y);
  vec3 agua = mix(vec3(0.04, 0.10, 0.19), vec3(0.78, 0.89, 1.0), cielo * 0.9);
  vec2 foco = q - vec2(0.30, 0.50);
  agua += vec3(0.92, 0.97, 1.0) * exp(-dot(foco, foco) * 10.0) * 0.85;  // cáustica
  float borde = smoothstep(0.70, 1.0, d);
  agua = mix(agua, vec3(0.015, 0.05, 0.11), borde * 0.8);               // reflexión interna
  vec3 rl = reflect(-L, n);
  float brillo = pow(max(rl.z, 0.0), 110.0) * 1.8 + pow(max(rl.z, 0.0), 14.0) * 0.16;
  vec3 L2 = normalize(vec3(0.55, 0.35, 0.76));
  brillo += pow(max(reflect(-L2, n).z, 0.0), 60.0) * 0.35;               // reflejo secundario
  float fresnel = pow(1.0 - z, 2.4);
  float alfa = max(mix(0.34, 0.92, fresnel), borde * 0.85) / sqrt(estirar);
  brillo /= estirar;
  return vec4(agua * alfa + brillo, clamp(alfa + brillo, 0.0, 1.0)) * cubre;
}

vec4 sobre(vec4 arriba, vec4 abajo) { return arriba + abajo * (1.0 - arriba.a); }

// El borde del agua visto de cerca: un cordón transparente, redondeado como un menisco,
// que deja ver la página detrás. Oscuro en el filo (reflexión interna), con un brillo
// donde mira a la luz y una línea clara donde enfoca la luz hacia dentro.
vec4 frente(vec2 p, float hondo) {
  float u = clamp(hondo / FRENTE, 0.0, 1.0);              // 0 en el filo, 1 dentro
  vec2 dir = normalize(vec2(aguaSd(p + vec2(1.0, 0.0)) - aguaSd(p - vec2(1.0, 0.0)),
                            aguaSd(p + vec2(0.0, 1.0)) - aguaSd(p - vec2(0.0, 1.0))) + 0.0001);
  float h = sqrt(max(0.0, 1.0 - (1.0 - u) * (1.0 - u)));
  vec3 n = normalize(vec3(dir * (1.0 - u), h + 0.0001));
  vec3 L = normalize(LUZ);
  float filo = smoothstep(0.55, 0.0, u);
  vec3 agua = mix(vec3(0.70, 0.84, 0.98), vec3(0.015, 0.05, 0.11), filo * 0.85);
  agua += vec3(0.9, 0.96, 1.0) * exp(-pow((u - 0.62) / 0.12, 2.0)) * 0.55;   // cáustica
  vec3 rl = reflect(-L, n);
  float brillo = pow(max(rl.z, 0.0), 60.0) * 1.4 + pow(max(rl.z, 0.0), 10.0) * 0.12;
  float alfa = mix(0.16, 0.85, filo) * smoothstep(1.0, 0.7, u);
  float aa = clamp(hondo * uDpr + 0.5, 0.0, 1.0);
  return vec4(agua * alfa + brillo, clamp(alfa + brillo, 0.0, 1.0)) * aa;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uLienzo.y - gl_FragCoord.y) / uDpr;
  vec4 color = vec4(0.0);

  if (uTi >= 0.0) {
    float hondo = -aguaSd(p);
    if (hondo > -1.0) {
      // Agua transparente: se ve por cómo concentra la luz (cáusticas claras y oscuras),
      // por un leve tono y por los destellos donde la superficie mira a la luz.
      float h0 = ondas(p);
      float hd = ondas(p + vec2(1.5, 0.0)), hi = ondas(p - vec2(1.5, 0.0));
      float hb = ondas(p + vec2(0.0, 1.5)), ha = ondas(p - vec2(0.0, 1.5));
      float lap = hd + hi + hb + ha - 4.0 * h0;
      vec2 g = vec2(hd - hi, hb - ha) / 3.0;
      vec3 n = normalize(vec3(-g * 2.2, 1.0));
      vec3 L = normalize(LUZ);
      float oscuro = clamp(-lap * 0.9, 0.0, 0.28);
      float claro = clamp(lap * 0.9, 0.0, 0.45);
      float destello = pow(max(reflect(-L, n).z, 0.0), 40.0) * 0.8;
      float tinte = 0.10 * exp(-uTi * 1.2);
      vec3 c = vec3(0.03, 0.09, 0.18) * oscuro + vec3(0.80, 0.92, 1.0) * claro
             + vec3(0.35, 0.58, 0.85) * tinte + vec3(destello);
      color = vec4(c, clamp(oscuro + claro * 0.6 + tinte + destello, 0.0, 0.8));
      color = sobre(frente(p, hondo), color * smoothstep(0.0, 2.0, hondo));
      color *= uFin;
    }
  }

  for (int i = 0; i < ${GOTITAS}; i++) {
    vec4 g = uGotitas[i];
    if (g.w > 0.0) color = sobre(esfera(p, g.xy, g.z, 1.0) * g.w, color);
  }
  if (uHayGota > 0.5) color = sobre(esfera(p, uGota.xy, uGota.z, uGota.w), color);

  gl_FragColor = clamp(color, 0.0, 1.0);
}`;

function crearPintor() {
  try {
    const lienzo = document.createElement('canvas');
    lienzo.setAttribute('aria-hidden', 'true');
    lienzo.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:${CAPA_Z}`;
    const gl = lienzo.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;

    const compilar = (tipo, fuente) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, fuente);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const programa = gl.createProgram();
    gl.attachShader(programa, compilar(gl.VERTEX_SHADER, VERTICES));
    gl.attachShader(programa, compilar(gl.FRAGMENT_SHADER, FRAGMENTOS));
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programa));
    gl.useProgram(programa);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(programa, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    for (const nombre of ['uLienzo', 'uDpr', 'uGota', 'uHayGota', 'uImpacto', 'uTi', 'uRadio', 'uAmplitud',
                          'uCaja', 'uEsquina', 'uFin', 'uGotitas']) {
      u[nombre] = gl.getUniformLocation(programa, nombre);
    }
    const gotitas = new Float32Array(GOTITAS * 4);
    let dpr = 1;

    // Un dibujo de calentamiento: muchos navegadores no compilan de verdad el sombreador
    // hasta el primer dibujo, y eso daría un tirón justo al tocar la burbuja.
    lienzo.width = lienzo.height = 1;
    gl.viewport(0, 0, 1, 1);
    gl.uniform1f(u.uTi, 0.1);
    gl.uniform1f(u.uHayGota, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();

    return {
      empezar(caja, esquina) {
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);  // el agua es suave: más resolución no se nota y cuesta
        lienzo.width = Math.round(window.innerWidth * dpr);
        lienzo.height = Math.round(window.innerHeight * dpr);
        gl.viewport(0, 0, lienzo.width, lienzo.height);
        gl.uniform2f(u.uLienzo, lienzo.width, lienzo.height);
        gl.uniform1f(u.uDpr, dpr);
        gl.uniform4f(u.uCaja, caja.x, caja.y, caja.ancho, caja.alto);
        gl.uniform1f(u.uEsquina, esquina);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        document.body.appendChild(lienzo);
      },
      pintar(e) {
        gl.uniform2f(u.uImpacto, e.impacto.x, e.impacto.y);
        gl.uniform1f(u.uTi, e.ti);
        gl.uniform1f(u.uRadio, e.radio);
        gl.uniform1f(u.uAmplitud, e.amplitud);
        gl.uniform1f(u.uFin, e.fin);
        gl.uniform1f(u.uHayGota, e.gota ? 1 : 0);
        if (e.gota) gl.uniform4f(u.uGota, e.gota.x, e.gota.y, e.gota.radio, e.gota.estirar);
        gotitas.fill(0);
        e.gotitas.forEach((g, i) => gotitas.set([g.x, g.y, g.radio, g.alfa], i * 4));
        gl.uniform4fv(u.uGotitas, gotitas);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      terminar() {
        lienzo.remove();
      },
    };
  } catch (error) {
    console.warn('La gota de EVA no tiene WebGL; el agua se derramará sin la gota:', error);
    return null;
  }
}

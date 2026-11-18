// La gota de EVA: al abrir la burbuja, una gota cae desde lo alto de la pantalla,
// salpica al llegar y la ventana del chat se abre desde el punto del impacto,
// como una onda en el agua.
//
// No toca el bot ni lo que se envía: solo anima la ventana de la burbuja (la
// parte «bot» que Typebot deja accesible) y una capa propia, por encima de la
// página, que se borra al terminar. Si algo no encaja (otra versión de la
// burbuja, un navegador sin animaciones web) o el sistema pide reducir el
// movimiento, la burbuja se abre como siempre.
//
// Uso, junto al resto de opciones de la burbuja:
//   import gota from './gota/eva-gota.js'
//   Typebot.initBubble({ typebot: "…", ...gota(), theme: { … } })

const CAPA_Z = 424243;  // justo por encima de la burbuja de Typebot (424242)
const GOTA = 'M60 10C60 10 24 50 24 74a36 36 0 0 0 72 0C96 50 60 10 60 10Z';  // el isotipo de EVA
const ANCHO_GOTA = 34, ALTO_GOTA = ANCHO_GOTA * 100 / 72;
const ABRIR = 760;  // ms que tarda la ventana en extenderse desde el impacto
const EXTENDER = 'cubic-bezier(.3,.62,.3,1)';  // rápido al principio, se calma al llenar

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function gota() {
  let abierta = false;
  let enCurso = null;

  const parar = () => {
    if (enCurso) enCurso();
    enCurso = null;
  };

  return {
    onOpen() {
      // Typebot.open() también llega aquí con la ventana ya abierta: entonces no se repite.
      if (abierta) return;
      abierta = true;
      if (reducido() || typeof Element.prototype.animate !== 'function') return;
      try {
        enCurso = caer();
      } catch (error) {
        console.warn('La gota de EVA no se pudo animar:', error);
      }
    },
    onClose() {
      abierta = false;
      parar();
    },
  };
}

function caer() {
  const ventana = document.querySelector('typebot-bubble')?.shadowRoot?.querySelector('[part="bot"]');
  const base = ventana?.offsetParent;
  if (!base) return null;

  // Cerrada, la ventana está escalada a cero; su posición y tamaño sin escalar
  // dicen dónde va a quedar.
  const marco = base.getBoundingClientRect();
  const caja = {
    x: marco.left + ventana.offsetLeft,
    y: marco.top + ventana.offsetTop,
    ancho: ventana.offsetWidth,
    alto: ventana.offsetHeight,
  };
  const impactoX = caja.x + caja.ancho / 2;
  const impactoY = Math.min(caja.y + caja.alto, window.innerHeight - 8);

  // Caída con aceleración, como la gravedad: el tiempo crece con la raíz de la distancia.
  const salida = -ALTO_GOTA - 24;
  const caida = Math.round(Math.min(680, Math.max(420, 21 * Math.sqrt(impactoY - salida))));
  const total = caida + ABRIR;

  const capa = document.createElement('div');
  capa.setAttribute('aria-hidden', 'true');
  capa.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${CAPA_Z};overflow:hidden;contain:strict`;
  document.body.appendChild(capa);
  const animaciones = [];
  const animar = (el, fotogramas, opciones) => {
    const a = el.animate(fotogramas, opciones);
    animaciones.push(a);
    return a;
  };

  // La ventana: oculta mientras cae la gota y, desde el impacto, un círculo que
  // crece desde su borde inferior hasta cubrirla (con margen para la sombra).
  const radio = Math.ceil(Math.hypot(caja.ancho / 2, caja.alto)) + 40;
  const centro = `at 50% ${impactoY - caja.y}px`;
  const fImpacto = caida / total;
  animar(ventana, [
    { offset: 0, clipPath: `circle(0px ${centro})`, transform: 'none', opacity: 1 },
    { offset: fImpacto, clipPath: `circle(0px ${centro})`, transform: 'none', opacity: 1,
      easing: EXTENDER },
    { offset: 1, clipPath: `circle(${radio}px ${centro})`, transform: 'none', opacity: 1 },
  ], { duration: total });

  // El frente de la onda: un anillo azul que recorre la ventana mientras se abre,
  // recortado a su forma para que no se salga.
  const marcoOnda = document.createElement('div');
  marcoOnda.style.cssText = `position:absolute;left:${caja.x}px;top:${caja.y}px;width:${caja.ancho}px;` +
    `height:${caja.alto}px;border-radius:8px;overflow:hidden`;
  const frente = document.createElement('div');
  frente.style.cssText = `position:absolute;left:${impactoX - caja.x - radio}px;top:${impactoY - caja.y - radio}px;` +
    `width:${radio * 2}px;height:${radio * 2}px;border-radius:50%;box-sizing:border-box;` +
    'border:3px solid rgba(58,109,181,.55);box-shadow:inset 0 0 36px 10px rgba(127,176,236,.4);opacity:0';
  marcoOnda.appendChild(frente);
  capa.appendChild(marcoOnda);
  animar(frente, [
    { transform: 'scale(0)', opacity: 1, easing: EXTENDER },
    { offset: .7, transform: 'scale(.82)', opacity: .9 },
    { transform: 'scale(1)', opacity: 0 },
  ], { duration: ABRIR, delay: caida });

  // La gota: se estira al caer y se aplasta contra la superficie.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '24 10 72 100');
  svg.setAttribute('width', ANCHO_GOTA);
  svg.setAttribute('height', ALTO_GOTA);
  svg.style.cssText = 'position:absolute;left:0;top:0;transform-origin:50% 100%;overflow:visible;' +
    'filter:drop-shadow(0 6px 10px rgba(16,40,80,.28))';
  svg.innerHTML =
    '<defs><linearGradient id="eva-gota-agua" x1="0" y1="0" x2=".35" y2="1">' +
    '<stop offset="0" stop-color="#b8d8fa"/><stop offset=".5" stop-color="#5a90db"/>' +
    '<stop offset="1" stop-color="#2b5ea8"/></linearGradient></defs>' +
    // El borde claro la separa de los fondos oscuros de la web.
    `<path d="${GOTA}" fill="url(#eva-gota-agua)" stroke="rgba(255,255,255,.6)" stroke-width="3"/>` +
    '<ellipse cx="46" cy="72" rx="7" ry="13" fill="#fff" opacity=".55" transform="rotate(18 46 72)"/>';
  capa.appendChild(svg);
  const x = impactoX - ANCHO_GOTA / 2, y = impactoY - ALTO_GOTA;
  animar(svg, [
    { offset: 0, transform: `translate(${x}px, ${salida}px) scale(.82, .9)`, easing: 'cubic-bezier(.55,.085,.68,.53)' },
    { offset: caida / (caida + 150), transform: `translate(${x}px, ${y}px) scale(.86, 1.22)`, easing: 'ease-out' },
    { offset: 1, transform: `translate(${x}px, ${y}px) scale(1.9, .22)`, opacity: 0 },
  ], { duration: caida + 150, fill: 'forwards' });

  // Al chocar: salpicaduras que saltan en arco...
  const salpicaduras = [[-58, 46, 7], [-34, 70, 5], [-12, 84, 6], [14, 80, 5], [36, 66, 7], [60, 42, 5], [-80, 24, 4], [82, 26, 4]];
  for (const [dx, alto, tam] of salpicaduras) {
    const p = document.createElement('div');
    p.style.cssText = `position:absolute;left:${impactoX - tam / 2}px;top:${impactoY - tam}px;width:${tam}px;` +
      `height:${tam}px;border-radius:50%;background:#3a6db5;opacity:0`;
    capa.appendChild(p);
    animar(p, [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, easing: 'cubic-bezier(.2,.6,.4,1)' },
      { offset: .45, transform: `translate(${dx * .6}px, ${-alto}px) scale(.9)`, opacity: 1, easing: 'cubic-bezier(.5,0,.8,.4)' },
      { transform: `translate(${dx}px, ${-alto * .15}px) scale(.45)`, opacity: 0 },
    ], { duration: 520, delay: caida });
  }

  // ...y ondas que se abren sobre la superficie.
  for (const [retraso, ancho] of [[0, Math.min(caja.ancho * .9, 340)], [130, Math.min(caja.ancho * 1.15, 440)]]) {
    const onda = document.createElement('div');
    onda.style.cssText = `position:absolute;left:${impactoX - 20}px;top:${impactoY - 7}px;width:40px;height:14px;` +
      'border-radius:50%;border:2px solid rgba(58,109,181,.6);box-sizing:border-box;opacity:0';
    capa.appendChild(onda);
    animar(onda, [
      { transform: 'scale(.3)', opacity: .9 },
      { transform: `scale(${ancho / 40})`, opacity: 0 },
    ], { duration: 720, delay: caida + retraso, easing: 'cubic-bezier(.15,.7,.3,1)' });
  }

  // Al terminar todo (o al cerrar la ventana a medias) no queda nada en la página.
  const limpiar = () => {
    for (const a of animaciones) a.cancel();
    capa.remove();
  };
  Promise.all(animaciones.map(a => a.finished)).then(limpiar, () => {});
  return limpiar;
}

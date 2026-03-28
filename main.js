/**
 * Sequência: 1) pictograma SVG (DrawSVG)  2) envelope fechado (clique)
 * 3) áudio + monograma em “burst”  4) carta final + partículas + seta.
 */

const cartaTilt = () => document.getElementById("cartaTilt");
const cartaTiltInner = () => document.getElementById("cartaTiltInner");
const cartaEnvelopeTilt = () => document.getElementById("cartaEnvelopeTilt");
const cartaEnvelopeTiltInner = () =>
  document.getElementById("cartaEnvelopeTiltInner");
const cartaSvgMount = () => document.getElementById("cartaSvgMount");
const cenaParticulas = () => document.getElementById("cenaParticulas");
const cartaFechadaBtn = () => document.getElementById("cartaFechadaBtn");
const envelopePointer = () => document.getElementById("cenaEnvelopePointer");
const cenaBurst = () => document.getElementById("cenaBurst");
const burstMonograma = () => document.getElementById("burstMonograma");
const cenaScrollHint = () => document.getElementById("cenaScrollHint");
const painelConvite = () => document.getElementById("painelConvite");

let tiltAtivo = false;
let tiltHandler = null;
let tiltWrapEl = null;
let tiltLeaveHandler = null;
let conviteAberto = false;
let audioViolino = null;

/** Chamado quando o painel do convite fica visível (MutationObserver em mobile é frágil). */
let notificarHeroPainelVisivel = () => {};

const NS = "http://www.w3.org/2000/svg";

const CONTORNO_ICONE_SVG = encodeURI(
  "src/icons/bride-and-groom-pictogram-3-svgrepo-com.svg"
);

const AUDIO_VIOLINO = encodeURI(
  "src/audio/violino-instrumental---kalvert-richard-felipe-rodrigues.mp3"
);

function getAudioViolino() {
  if (!audioViolino) {
    audioViolino = new Audio(AUDIO_VIOLINO);
    audioViolino.preload = "auto";
  }
  return audioViolino;
}

/** Pausa o violino quando a aba/janela deixa de estar visível (minimizar, trocar de aba, etc.). */
function configurarPausaAudioQuandoOculto() {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    const a = audioViolino;
    if (a && !a.paused) a.pause();
  });
}

/** Barra com logo do convite só depois do primeiro scroll (não na abertura). */
function configurarBarraMarcaAposPrimeiroScroll() {
  const bar = document.getElementById("conteudoBarraMarca");
  if (!bar) return;
  const cls = "conteudo__barra-marca--visivel";
  let feito = false;
  const opts = { passive: true };
  function revelar() {
    if (feito) return;
    feito = true;
    bar.classList.add(cls);
    window.removeEventListener("scroll", revelar, opts);
  }
  window.addEventListener("scroll", revelar, opts);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Telemóveis / tablets sem hover fiável — carrossel 3D e DrawSVG costumam falhar. */
function isModoToqueSemHover() {
  try {
    return window.matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

function prepararTracoSvgNativo(path) {
  try {
    const len = path.getTotalLength();
    if (!len || !Number.isFinite(len)) return 0;
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    return len;
  } catch {
    return 0;
  }
}

function usarDesenhoTracoNativo(pluginOk) {
  if (!pluginOk) return true;
  return isModoToqueSemHover();
}

function polygonParaPathD(el) {
  const raw = (el.getAttribute("points") || "").trim();
  if (!raw) return "";
  const tokens = raw.split(/\s+/);
  const first = tokens[0].split(",");
  if (first.length < 2) return "";
  let d = `M ${first[0]},${first[1]}`;
  for (let i = 1; i < tokens.length; i++) {
    const [x, y] = tokens[i].split(",");
    if (x != null && y != null) d += ` L ${x},${y}`;
  }
  return `${d} Z`;
}

function duracaoDrawPath(path) {
  try {
    const len = path.getTotalLength();
    return Math.min(3.5, Math.max(0.7, len / 400));
  } catch {
    return 1.35;
  }
}

async function montarAliancasSvg(mount) {
  if (!mount) return null;

  try {
    const res = await fetch(CONTORNO_ICONE_SVG);
    if (!res.ok) throw new Error(String(res.status));
    let text = await res.text();
    text = text.replace(/<!DOCTYPE[^>]*>/i, "");
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const src = doc.querySelector("svg");
    if (!src) return null;

    const rawEls = [...src.querySelectorAll("path, polygon")].filter((n) => {
      const tag = n.localName;
      if (tag === "path") return n.getAttribute("d")?.trim();
      if (tag === "polygon") return n.getAttribute("points")?.trim();
      return false;
    });
    if (!rawEls.length) return null;

    const defs = rawEls
      .map((node) => {
        if (node.localName === "path") {
          return node.getAttribute("d").replace(/\s+/g, " ").trim();
        }
        return polygonParaPathD(node).replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
    if (!defs.length) return null;

    const svg = document.createElementNS(NS, "svg");
    const vb = src.getAttribute("viewBox") || "0 0 512 512";
    svg.setAttribute("viewBox", vb);
    svg.setAttribute("class", "cena__cartas-svg cena__aliancas-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Noivos — pictograma");

    const strokes = [
      { stroke: "#b8944f", width: "2.15" },
      { stroke: "#c9a962", width: "1.95" },
    ];

    defs.forEach((d, i) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      const st = strokes[i % strokes.length];
      p.setAttribute("stroke", st.stroke);
      p.setAttribute("stroke-width", st.width);
      p.setAttribute("stroke-linejoin", "round");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("vector-effect", "non-scaling-stroke");
      p.classList.add("cena__alianca-traco", `cena__alianca-traco--p${i}`);
      svg.appendChild(p);
    });

    mount.innerHTML = "";
    mount.appendChild(svg);

    const tracos = [...svg.querySelectorAll("path")];
    return { svg, tracos };
  } catch {
    mount.innerHTML =
      '<p class="cena__erro">Use um servidor local para carregar o ícone SVG.</p>';
    return null;
  }
}

function criarGrainParticula(host, i, seed) {
  const roll = seed ?? Math.random();
  let kind = "neve";
  if (roll < 0.34) kind = "arroz";
  else if (roll < 0.58) kind = "dourado";

  const lento = Math.random() > 0.68;
  const el = document.createElement("span");
  el.className = `cena__grain cena__grain--${kind}`;
  if (lento) el.classList.add("cena__grain--lento");
  el.style.left = `${(i * 11 + Math.random() * 62) % 100}%`;
  const baseDur = lento ? 18 + Math.random() * 22 : 9 + Math.random() * 12;
  const delay = -(Math.random() * 28);
  el.style.animationDuration = `${baseDur}s`;
  el.style.animationDelay = `${delay}s`;
  el.style.webkitAnimationDuration = `${baseDur}s`;
  el.style.webkitAnimationDelay = `${delay}s`;
  const g = 0.55 + Math.random() * 1.2;
  el.style.setProperty("--g", String(g));
  el.style.setProperty("--dx", `${(Math.random() - 0.5) * 56}px`);
  el.style.setProperty("--rot", `${(Math.random() - 0.5) * 520}deg`);
  host.appendChild(el);
}

function iniciarParticulasCena() {
  if (prefersReducedMotion()) return;
  const host = cenaParticulas();
  if (!host) return;

  host.innerHTML = "";
  host.classList.add("cena__particulas--ativa");

  const total = isModoToqueSemHover() ? 52 : 102;
  for (let i = 0; i < total; i++) {
    criarGrainParticula(host, i);
  }
}

/** Mais partículas após abrir o convite (substitui as fitas). */
function reforcarParticulasAposAbertura() {
  if (prefersReducedMotion()) return;
  const host = cenaParticulas();
  if (!host || host.dataset.reforco) return;
  host.dataset.reforco = "1";
  const base = host.querySelectorAll(".cena__grain").length;
  const extra = isModoToqueSemHover() ? 22 : 48;
  for (let j = 0; j < extra; j++) {
    criarGrainParticula(host, base + j, Math.random());
  }
}

/** Flutuação vertical + brilho (mesmo efeito da carta final). */
function iniciarDestaqueTilt(wrap, inner) {
  if (prefersReducedMotion() || !wrap || !inner) return;

  gsap.to(wrap, {
    y: 5,
    repeat: -1,
    yoyo: true,
    duration: 4.2,
    ease: "sine.inOut",
  });

  inner.classList.add("cena__tilt-inner--destaque");
}

function iniciarDestaqueCartaESelo() {
  iniciarDestaqueTilt(cartaTilt(), cartaTiltInner());
}

function pararTiltCursor() {
  if (tiltHandler) {
    window.removeEventListener("pointermove", tiltHandler);
    tiltHandler = null;
  }
  if (tiltWrapEl && tiltLeaveHandler) {
    tiltWrapEl.removeEventListener("pointerleave", tiltLeaveHandler);
    tiltLeaveHandler = null;
  }
  tiltWrapEl = null;
  tiltAtivo = false;
}

/** Tilt 3D ao mover o rato (igual à carta final). */
function iniciarTiltCursorPara(wrap, inner) {
  if (!wrap || !inner || prefersReducedMotion()) return;

  pararTiltCursor();

  gsap.set(wrap, { perspective: 1100 });
  gsap.set(inner, {
    transformOrigin: "50% 50%",
    transformPerspective: 1100,
    force3D: true,
  });

  tiltAtivo = true;
  tiltWrapEl = wrap;
  const maxX = 14;
  const maxY = 11;

  tiltHandler = (e) => {
    if (!tiltAtivo) return;
    const r = wrap.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(inner, {
      rotationY: px * 2 * maxX,
      rotationX: -py * 2 * maxY,
      duration: 0.45,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  window.addEventListener("pointermove", tiltHandler, { passive: true });

  tiltLeaveHandler = () => {
    gsap.to(inner, {
      rotationY: 0,
      rotationX: 0,
      duration: 0.6,
      ease: "power2.out",
    });
  };
  wrap.addEventListener("pointerleave", tiltLeaveHandler, { passive: true });
}

function iniciarTiltCursor() {
  iniciarTiltCursorPara(cartaTilt(), cartaTiltInner());
}

function mostrarEnvelopeConvite() {
  const envTilt = cartaEnvelopeTilt();
  const ptr = envelopePointer();
  const reduzir = prefersReducedMotion();
  const d = reduzir ? 0.35 : 0.72;
  if (envTilt) {
    gsap.fromTo(
      envTilt,
      { autoAlpha: 0, scale: 0.97 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: d,
        ease: "power3.out",
        onComplete: () => {
          if (!reduzir) {
            iniciarTiltCursorPara(
              cartaEnvelopeTilt(),
              cartaEnvelopeTiltInner()
            );
            iniciarDestaqueTilt(
              cartaEnvelopeTilt(),
              cartaEnvelopeTiltInner()
            );
          }
        },
      }
    );
  }
  if (ptr) {
    const atrasoPosEnvelope = reduzir ? 0.15 : 1.25;
    gsap.to(ptr, {
      autoAlpha: 1,
      duration: reduzir ? 0.4 : 0.6,
      ease: "power2.out",
      delay: d + atrasoPosEnvelope,
    });
  }
}

function onCliqueAbrirConvite() {
  if (conviteAberto) return;
  conviteAberto = true;

  const btn = cartaFechadaBtn();
  const envTilt = cartaEnvelopeTilt();
  const envInner = cartaEnvelopeTiltInner();
  const burst = cenaBurst();
  const burstImg = burstMonograma();
  const tilt = cartaTilt();
  const hint = cenaScrollHint();
  const painel = painelConvite();
  const reduzir = prefersReducedMotion();

  const ptr = envelopePointer();
  if (btn) {
    btn.disabled = true;
    btn.setAttribute("tabindex", "-1");
  }

  pararTiltCursor();
  if (envInner) {
    envInner.classList.remove("cena__tilt-inner--destaque");
  }
  if (envTilt) {
    gsap.killTweensOf(envTilt);
    gsap.set(envTilt, { y: 0 });
  }
  if (envInner) {
    gsap.killTweensOf(envInner);
    gsap.set(envInner, { rotationX: 0, rotationY: 0 });
  }

  getAudioViolino().play().catch(() => {});

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  if (envTilt) {
    tl.to(envTilt, { scale: 0.99, duration: 0.1, ease: "sine.inOut" });
    tl.to(envTilt, { scale: 1, duration: 0.15, ease: "sine.out" });
    tl.to(envTilt, { autoAlpha: 0, duration: 0.4, ease: "power2.inOut" });
  }
  if (ptr) {
    tl.to(
      ptr,
      { autoAlpha: 0, duration: 0.4, ease: "power2.inOut" },
      "<"
    );
  }

  if (burst && burstImg) {
    tl.add(() => {
      burst.setAttribute("aria-hidden", "false");
      gsap.set(burst, { visibility: "visible" });
      gsap.set(burstImg, { clearProps: "transform,opacity" });
    });
    tl.set(burst, { autoAlpha: 1 });

    if (reduzir) {
      tl.fromTo(
        burstImg,
        { scale: 0.52, opacity: 1 },
        { scale: 0.98, duration: 0.65, ease: "power2.out" }
      );
      tl.to(burst, { autoAlpha: 0, duration: 0.45, ease: "power1.inOut" });
    } else {
      tl.fromTo(
        burstImg,
        { scale: 0.28, yPercent: 2, opacity: 0.9 },
        {
          scale: 1.82,
          yPercent: -5,
          duration: 2.85,
          ease: "power3.inOut",
        }
      );
      tl.to(
        burstImg,
        { opacity: 0, duration: 0.75, ease: "power1.inOut" },
        "-=0.5"
      );
      tl.to(burst, { autoAlpha: 0, duration: 0.55, ease: "power1.inOut" });
    }

    tl.add(() => {
      burst.setAttribute("aria-hidden", "true");
      gsap.set(burst, { visibility: "hidden" });
    });
  }

  if (tilt) {
    tl.fromTo(
      tilt,
      { autoAlpha: 0, scale: 0.97 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: reduzir ? 0.45 : 1.05,
        ease: "power3.out",
        onStart: () => {
          tilt.style.pointerEvents = "auto";
          tilt.removeAttribute("aria-hidden");
        },
      }
    );
  }

  tl.add(() => {
    reforcarParticulasAposAbertura();
    hint?.classList.add("cena__scroll-hint--visivel");
    painel?.removeAttribute("hidden");
    notificarHeroPainelVisivel();
    if (!reduzir) {
      iniciarTiltCursor();
      iniciarDestaqueCartaESelo();
    }
  });
}

function configurarCliqueEnvelope() {
  const btn = cartaFechadaBtn();
  if (!btn) return;
  btn.addEventListener("click", onCliqueAbrirConvite, { once: true });
}

async function runSequencia() {
  if (typeof window.gsap === "undefined") {
    iniciarParticulasCena();
    mostrarEnvelopeConvite();
    return;
  }

  const mount = cartaSvgMount();
  const tilt = cartaTilt();
  const envTilt = cartaEnvelopeTilt();
  const burst = cenaBurst();
  const ptr = envelopePointer();

  try {
    if (mount) gsap.set(mount, { autoAlpha: 0, scale: 0.92 });
    gsap.set(tilt, { autoAlpha: 0, scale: 0.97 });
    if (tilt) tilt.style.pointerEvents = "none";
    if (envTilt) gsap.set(envTilt, { autoAlpha: 0, scale: 0.97 });
    if (ptr) gsap.set(ptr, { autoAlpha: 0 });
    if (burst) gsap.set(burst, { autoAlpha: 0, visibility: "hidden" });
  } catch {
    iniciarParticulasCena();
    mostrarEnvelopeConvite();
    return;
  }

  const env = await montarAliancasSvg(mount);
  const reduzir = prefersReducedMotion();
  const pluginOk = typeof window.DrawSVGPlugin !== "undefined";
  const tracoNativo = usarDesenhoTracoNativo(pluginOk);

  const pausaFundo = reduzir ? 0.35 : 1.05;
  const fadeTraco = reduzir ? 0.22 : 0.55;
  const cross = reduzir ? 0.35 : 0.65;

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  tl.to({}, { duration: pausaFundo });
  tl.call(iniciarParticulasCena, null, pausaFundo * 0.15);

  if (!env) {
    tl.add(() => mostrarEnvelopeConvite());
    return;
  }

  const { tracos } = env;

  if (!reduzir && tracoNativo) {
    tracos.forEach((p) => prepararTracoSvgNativo(p));
    tl.set(mount, { autoAlpha: 1, scale: 1 });
    tracos.forEach((p, i) => {
      const dur = duracaoDrawPath(p);
      const pos =
        i === 0 ? undefined : `-=${Math.min(0.5, dur * 0.22)}`;
      tl.to(
        p,
        { strokeDashoffset: 0, duration: dur, ease: "power1.inOut" },
        pos
      );
    });
    tl.to(tracos, {
      autoAlpha: 0,
      duration: fadeTraco,
      ease: "power2.in",
    });
  } else if (pluginOk && !reduzir) {
    gsap.registerPlugin(window.DrawSVGPlugin);
    gsap.set(tracos, { drawSVG: "0%" });
    tl.set(mount, { autoAlpha: 1, scale: 1 });
    tracos.forEach((p, i) => {
      const dur = duracaoDrawPath(p);
      const pos =
        i === 0 ? undefined : `-=${Math.min(0.5, dur * 0.22)}`;
      tl.to(p, { drawSVG: "100%", duration: dur, ease: "power1.inOut" }, pos);
    });
    tl.to(tracos, {
      autoAlpha: 0,
      duration: fadeTraco,
      ease: "power2.in",
    });
  } else {
    gsap.set(tracos, { autoAlpha: 1 });
    tl.set(mount, { autoAlpha: 1, scale: 1 });
    tl.fromTo(
      tracos,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: reduzir ? 0.35 : 0.75 }
    );
    tl.to(tracos, {
      autoAlpha: 0,
      duration: fadeTraco,
      ease: "power2.in",
    });
  }

  tl.to(mount, {
    autoAlpha: 0,
    scale: 0.96,
    duration: cross,
    ease: "power2.in",
    onComplete: () => {
      if (mount) mount.innerHTML = "";
    },
  });
  tl.add(() => mostrarEnvelopeConvite());
}

const HERO_SLIDE_INTERVAL_MS = 5000;

function configurarHeroSlideshow() {
  const root = document.getElementById("heroSlides");
  if (!root) {
    notificarHeroPainelVisivel = () => {};
    return;
  }

  const slides = root.querySelectorAll(".conteudo__hero-slide");
  const n = slides.length;
  if (n <= 1) {
    notificarHeroPainelVisivel = () => {};
    return;
  }

  const reduzir = prefersReducedMotion();
  let cur = 0;
  let timerId = null;

  function ativar(i) {
    slides.forEach((el, j) => {
      el.classList.toggle("is-active", j === i);
    });
  }

  function seguinte() {
    const next = (cur + 1) % n;
    slides.forEach((el, j) => {
      el.classList.toggle("is-active", j === next);
    });
    cur = next;
  }

  function limparTimer() {
    if (timerId != null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function iniciarTimer() {
    limparTimer();
    if (reduzir) return;
    const painel = painelConvite();
    if (!painel || painel.hasAttribute("hidden")) return;
    timerId = window.setInterval(() => {
      if (document.hidden) return;
      const p = painelConvite();
      if (!p || p.hasAttribute("hidden")) return;
      seguinte();
    }, HERO_SLIDE_INTERVAL_MS);
  }

  notificarHeroPainelVisivel = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => iniciarTimer());
    });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      limparTimer();
    } else {
      iniciarTimer();
    }
  });

  window.addEventListener("pageshow", (ev) => {
    if (ev.persisted) notificarHeroPainelVisivel();
  });

  const painel = painelConvite();
  if (painel) {
    new MutationObserver(() => {
      if (painel.hasAttribute("hidden")) {
        limparTimer();
      } else if (!document.hidden && !reduzir) {
        iniciarTimer();
      }
    }).observe(painel, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  ativar(0);
  iniciarTimer();
}

function copiarAtributosImg(origem, destino) {
  if (!origem || !destino) return;
  destino.alt = origem.alt || "";
  if (origem.width) destino.width = origem.width;
  if (origem.height) destino.height = origem.height;
  const ss = origem.getAttribute("srcset");
  const sz = origem.getAttribute("sizes");
  if (ss) destino.setAttribute("srcset", ss);
  else destino.removeAttribute("srcset");
  if (sz) destino.setAttribute("sizes", sz);
  else destino.removeAttribute("sizes");
  destino.src = origem.getAttribute("src") || origem.src;
}

function imagemDoSlide(slide) {
  return slide?.querySelector("img") ?? null;
}

function configurarScrollCarousel() {
  const root = document.getElementById("conteudoScrollCarousel");
  const viewport = document.getElementById("carouselViewport");
  const track = document.getElementById("carouselTrack");
  const baseImg = document.getElementById("carouselBaseImg");
  const flip = document.getElementById("carouselFlip");
  const flipImg = document.getElementById("carouselFlipImg");
  const prev = document.getElementById("carouselBtnPrev");
  const next = document.getElementById("carouselBtnNext");
  const fill = document.getElementById("carouselBarFill");
  const countEl = document.getElementById("scrollCarouselCount");

  if (!root || !viewport || !track || !baseImg || !flip || !flipImg) return;

  const slides = track.querySelectorAll(".conteudo__carousel-slide");
  const n = slides.length;
  if (!n) return;

  const reduzir = prefersReducedMotion();
  const modoPlano = !reduzir && isModoToqueSemHover();
  if (modoPlano) viewport.classList.add("conteudo__carousel-viewport--plano");

  let index = 0;
  let panStartX = 0;
  let panActive = false;
  let busy = false;

  function atualizarChrome() {
    if (fill) {
      fill.style.width = `${((index + 1) / n) * 100}%`;
    }
    if (countEl) {
      countEl.textContent = `${index + 1} / ${n}`;
    }
    root.dataset.active = String(index);
    root.setAttribute(
      "aria-label",
      `Galeria de momentos, álbum de fotos, foto ${index + 1} de ${n}`
    );

    if (prev) {
      prev.disabled = busy || index <= 0;
    }
    if (next) {
      next.disabled = busy || index >= n - 1;
    }
  }

  function resetFlipSemTransicao() {
    flip.classList.remove(
      "is-active",
      "is-next",
      "is-prev",
      "is-turned",
      "is-flip-play"
    );
    flip.style.animation = "none";
    flip.style.transition = "none";
    void flip.offsetWidth;
    flip.style.animation = "";
    flip.style.transition = "";
  }

  function finalizarVirada(novoIndex) {
    if (!busy) return;
    busy = false;
    index = novoIndex;
    resetFlipSemTransicao();
    const img = imagemDoSlide(slides[index]);
    if (img) copiarAtributosImg(img, baseImg);
    root.removeAttribute("aria-busy");
    atualizarChrome();
  }

  function irInstantaneo(delta) {
    const alvo = Math.max(0, Math.min(n - 1, index + delta));
    if (alvo === index) return;
    index = alvo;
    const img = imagemDoSlide(slides[index]);
    if (img) copiarAtributosImg(img, baseImg);
    atualizarChrome();
  }

  const MS_CROSSFADE_CARROSSEL = 380;

  function trocarPlano(delta) {
    const novoIndex = Math.max(0, Math.min(n - 1, index + delta));
    if (novoIndex === index || busy) return;
    const img = imagemDoSlide(slides[novoIndex]);
    if (!img) return;
    busy = true;
    root.setAttribute("aria-busy", "true");
    atualizarChrome();
    baseImg.style.opacity = "0";
    window.setTimeout(() => {
      copiarAtributosImg(img, baseImg);
      requestAnimationFrame(() => {
        baseImg.style.opacity = "1";
      });
      index = novoIndex;
      busy = false;
      root.removeAttribute("aria-busy");
      atualizarChrome();
    }, MS_CROSSFADE_CARROSSEL);
  }

  function virarProxima() {
    if (busy || index >= n - 1) return;
    if (reduzir) {
      irInstantaneo(1);
      return;
    }
    if (modoPlano) {
      trocarPlano(1);
      return;
    }

    const imgAtual = imagemDoSlide(slides[index]);
    const imgProx = imagemDoSlide(slides[index + 1]);
    if (!imgAtual || !imgProx) return;

    busy = true;
    root.setAttribute("aria-busy", "true");
    atualizarChrome();

    copiarAtributosImg(imgProx, baseImg);
    copiarAtributosImg(imgAtual, flipImg);

    flip.style.animation = "";
    flip.classList.remove("is-prev", "is-turned", "is-flip-play");
    flip.classList.add("is-active", "is-next");
    void flip.offsetWidth;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flip.classList.add("is-flip-play");
      });
    });

    const destinoIndex = index + 1;
    const tmo = window.setTimeout(() => {
      flip.removeEventListener("animationend", aoFimAnim);
      if (busy) finalizarVirada(destinoIndex);
    }, 2100);

    function aoFimAnim(e) {
      if (e.target !== flip) return;
      const nome = String(e.animationName || "");
      if (!/folhaVirar/i.test(nome)) return;
      window.clearTimeout(tmo);
      flip.removeEventListener("animationend", aoFimAnim);
      finalizarVirada(destinoIndex);
    }
    flip.addEventListener("animationend", aoFimAnim);
  }

  function virarAnterior() {
    if (busy || index <= 0) return;
    if (reduzir) {
      irInstantaneo(-1);
      return;
    }
    if (modoPlano) {
      trocarPlano(-1);
      return;
    }

    const imgAtual = imagemDoSlide(slides[index]);
    const imgAnt = imagemDoSlide(slides[index - 1]);
    if (!imgAtual || !imgAnt) return;

    busy = true;
    root.setAttribute("aria-busy", "true");
    atualizarChrome();

    copiarAtributosImg(imgAnt, baseImg);
    copiarAtributosImg(imgAtual, flipImg);

    flip.style.animation = "";
    flip.classList.remove("is-next", "is-turned", "is-flip-play");
    flip.classList.add("is-active", "is-prev");
    void flip.offsetWidth;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flip.classList.add("is-flip-play");
      });
    });

    const destinoIndex = index - 1;
    const tmo = window.setTimeout(() => {
      flip.removeEventListener("animationend", aoFimAnim);
      if (busy) finalizarVirada(destinoIndex);
    }, 2100);

    function aoFimAnim(e) {
      if (e.target !== flip) return;
      const nome = String(e.animationName || "");
      if (!/folhaVirar/i.test(nome)) return;
      window.clearTimeout(tmo);
      flip.removeEventListener("animationend", aoFimAnim);
      finalizarVirada(destinoIndex);
    }
    flip.addEventListener("animationend", aoFimAnim);
  }

  function ir(delta) {
    if (delta > 0) virarProxima();
    else if (delta < 0) virarAnterior();
  }

  const img0 = imagemDoSlide(slides[0]);
  if (img0) copiarAtributosImg(img0, baseImg);
  atualizarChrome();

  prev?.addEventListener("click", () => ir(-1));
  next?.addEventListener("click", () => ir(1));

  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      ir(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      ir(1);
    }
  });

  viewport.addEventListener("pointerdown", (e) => {
    if (busy) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    panActive = true;
    panStartX = e.clientX;
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });

  viewport.addEventListener("pointerup", (e) => {
    if (!panActive) return;
    panActive = false;
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const d = e.clientX - panStartX;
    if (d > 52) {
      ir(-1);
    } else if (d < -52) {
      ir(1);
    }
  });

  viewport.addEventListener("pointercancel", () => {
    panActive = false;
  });
}

function configurarContagemRegressiva() {
  const root = document.getElementById("conteudoCountdown");
  if (!root) return;

  const iso = root.getAttribute("data-event-at");
  if (!iso) return;

  const alvo = new Date(iso).getTime();
  if (Number.isNaN(alvo)) return;

  const elDias = document.getElementById("cdDias");
  const elHoras = document.getElementById("cdHoras");
  const elMin = document.getElementById("cdMin");
  const elSeg = document.getElementById("cdSeg");
  const elMsg = document.getElementById("cdMsg");

  function tick() {
    const agora = Date.now();
    let restante = alvo - agora;

    if (restante <= 0) {
      if (elDias) elDias.textContent = "0";
      if (elHoras) elHoras.textContent = "0";
      if (elMin) elMin.textContent = "0";
      if (elSeg) elSeg.textContent = "0";
      if (elMsg) {
        elMsg.hidden = false;
        elMsg.textContent = "Chegou o grande dia!";
      }
      root.setAttribute("aria-label", "O evento já começou ou está em curso.");
      return false;
    }

    if (elMsg) {
      elMsg.hidden = true;
      elMsg.textContent = "";
    }

    const dias = Math.floor(restante / 86400000);
    restante -= dias * 86400000;
    const horas = Math.floor(restante / 3600000);
    restante -= horas * 3600000;
    const min = Math.floor(restante / 60000);
    restante -= min * 60000;
    const seg = Math.floor(restante / 1000);

    if (elDias) elDias.textContent = String(dias);
    if (elHoras) elHoras.textContent = String(horas).padStart(2, "0");
    if (elMin) elMin.textContent = String(min).padStart(2, "0");
    if (elSeg) elSeg.textContent = String(seg).padStart(2, "0");

    root.setAttribute(
      "aria-label",
      `Faltam ${dias} dias, ${horas} horas, ${min} minutos e ${seg} segundos`
    );
    return true;
  }

  tick();
  const id = window.setInterval(() => {
    if (!tick()) window.clearInterval(id);
  }, 1000);
}

function configurarFinalConviteFesta() {
  const root = document.getElementById("conteudoFesta");
  if (!root) return;

  const reduzir = prefersReducedMotion();
  const revelar = root.querySelectorAll(".conteudo__reveal");
  if (!reduzir) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("conteudo__reveal--visivel");
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -32px 0px" }
    );
    revelar.forEach((el) => io.observe(el));
  } else {
    revelar.forEach((el) => el.classList.add("conteudo__reveal--visivel"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const hint = cenaScrollHint();
  hint?.addEventListener("click", (e) => {
    e.preventDefault();
    const alvo =
      document.getElementById("conteudoHero") || painelConvite();
    alvo?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
      inline: "nearest",
    });
  });

  configurarPausaAudioQuandoOculto();
  configurarBarraMarcaAposPrimeiroScroll();
  configurarHeroSlideshow();
  configurarScrollCarousel();
  configurarContagemRegressiva();
  configurarFinalConviteFesta();
  configurarCliqueEnvelope();
  runSequencia();
});

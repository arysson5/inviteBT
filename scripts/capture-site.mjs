import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 9344;
const WEB = 8765;
const WIDTH = 390;
const HEIGHT = 844;
const OUT = process.argv[2] || "/tmp/site-shots";

function startChrome() {
  rmSync("/tmp/chrome-site-profile", { recursive: true, force: true });
  return spawn(
    "google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      `--remote-debugging-port=${PORT}`,
      "--remote-debugging-address=127.0.0.1",
      "--user-data-dir=/tmp/chrome-site-profile",
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
}

async function waitVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* subindo */
    }
    await delay(200);
  }
  throw new Error("Chrome não abriu.");
}

function cdpClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result || {});
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const my = ++id;
      pending.set(my, { resolve, reject });
      ws.send(JSON.stringify({ id: my, method, params }));
    });
}

async function js(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 500));
  }
  return result.result ? result.result.value : undefined;
}

async function shot(send, name) {
  const image = await send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 80,
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const file = `${OUT}/${name}.jpg`;
  writeFileSync(file, Buffer.from(image.data, "base64"));
  console.log("shot", name);
}

async function waitUntil(send, expression, ms = 25000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const ok = await js(send, expression);
    if (ok) return;
    await delay(250);
  }
  throw new Error("timeout: " + expression.slice(0, 140));
}

async function goto(send, path) {
  await send("Page.navigate", { url: `http://127.0.0.1:${WEB}${path}` });
  await delay(600);
  await waitUntil(send, "document.readyState === 'complete'", 20000);
  await js(send, "document.fonts ? document.fonts.ready : true");
  await delay(400);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chrome = startChrome();
  try {
    await waitVersion();
    const pages = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
    const page = pages.find((p) => p.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const send = cdpClient(ws);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await goto(send, "/index.html");
    await waitUntil(
      send,
      `(() => {
        const el = document.getElementById('cartaEnvelopeTilt');
        if (!el) return false;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return parseFloat(s.opacity) > 0.9 && r.height > 80;
      })()`
    );
    await delay(500);
    await shot(send, "envelope");

    await js(send, "document.getElementById('cartaFechadaBtn').click()");
    for (let i = 0; i < 28; i++) {
      await delay(180);
      await shot(send, "open_" + String(i).padStart(2, "0"));
    }

    await waitUntil(
      send,
      `(() => {
        const p = document.getElementById('painelConvite');
        return !!(p && !p.hasAttribute('hidden'));
      })()`,
      12000
    );
    await js(
      send,
      `(() => {
        const p = document.getElementById('cenaEnvelopePointer');
        if (p) p.style.display = 'none';
        const hint = document.getElementById('cenaScrollHint');
        if (hint) hint.style.display = 'none';
        document.querySelectorAll('.conteudo__hero-slide').forEach((el, i) => {
          el.style.transition = 'none';
          el.style.opacity = i === 0 ? '1' : '0';
          el.classList.toggle('is-active', i === 0);
        });
      })()`
    );
    await delay(600);

    const scrolls = [
      ["hero", "conteudoHero"],
      ["album", "conteudoScrollCarousel"],
      ["data", "conteudoTituloData"],
      ["contagem", "conteudoTituloContagem"],
      ["mapa", "conteudoTituloLocal"],
      ["traje", "conteudoTituloTraje"],
      ["ritmo", "conteudoTituloRitmo"],
      ["rsvp-cta", "conteudoTituloRsvp"],
      ["citacao", "conteudoFesta"],
    ];

    for (const [name, id] of scrolls) {
      if (name === "ritmo") {
        await js(
          send,
          `document.querySelectorAll('.conteudo__timeline-slot').forEach(d => { d.open = true; })`
        );
      }
      await js(
        send,
        `document.getElementById('${id}').scrollIntoView({block:'center', inline:'nearest'})`
      );
      await delay(700);
      if (name === "hero" || name === "album") {
        await js(
          send,
          `(() => {
            const img = document.querySelector('#conteudoHero img, #carouselBaseImg');
            if (img && !img.complete) return false;
            return true;
          })()`
        );
        await delay(800);
      }
      await shot(send, name);
    }

    await js(
      send,
      `document.getElementById('carouselBtnNext') && document.getElementById('carouselBtnNext').click()`
    );
    await delay(900);
    await shot(send, "album-2");

    await goto(send, "/rsvp.html");
    await delay(400);
    await shot(send, "rsvp");

    await goto(send, "/presentes.html");
    await delay(500);
    await shot(send, "presentes-gate");

    await js(
      send,
      `(() => {
        const gate = document.getElementById('presentesGate');
        const app = document.getElementById('presentesApp');
        const welcome = document.getElementById('presentesWelcome');
        const err = document.getElementById('presentesLoadErr');
        if (gate) gate.hidden = true;
        if (app) app.hidden = false;
        if (welcome) welcome.hidden = true;
        if (err) err.hidden = true;
      })()`
    );
    await delay(300);
    await shot(send, "presentes-pix");

    await goto(send, "/admin.html");
    await delay(300);
    await shot(send, "admin-login");
    await js(
      send,
      `(() => {
        const login = document.getElementById('adminLogin');
        const panel = document.getElementById('adminPanel');
        if (login) login.hidden = true;
        if (panel) panel.hidden = false;
      })()`
    );
    await delay(250);
    await shot(send, "admin-stats");
    await js(
      send,
      `document.getElementById('formAddPresente').scrollIntoView({block:'center'})`
    );
    await delay(400);
    await shot(send, "admin-form");
    await js(
      send,
      `document.getElementById('listaConvidados').scrollIntoView({block:'center'})`
    );
    await delay(400);
    await shot(send, "admin-listas");

    ws.close();
    console.log("captura ok");
  } finally {
    chrome.kill("SIGKILL");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

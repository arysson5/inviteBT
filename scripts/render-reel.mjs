import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const PORT = 9333;
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const HTML = "file:///workspace/pitch/reel.html?freeze=1";
const OUT_DIR = process.argv[2] || "/tmp/reel-frames";
const MODE = process.argv[3] || "full";

const STILLS = [0.5, 2.3, 5.6, 8.1, 15.4, 20.3, 28.0, 33.0, 41.2];

function startChrome() {
  rmSync("/tmp/chrome-reel-profile", { recursive: true, force: true });
  const proc = spawn(
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
      "--user-data-dir=/tmp/chrome-reel-profile",
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  return proc;
}

async function waitVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* chrome ainda subindo */
    }
    await delay(200);
  }
  throw new Error("Chrome não abriu o depurador.");
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
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
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: HTML });
    await delay(700);
    await send("Runtime.evaluate", {
      expression: "document.fonts.ready",
      awaitPromise: true,
    });

    const times =
      MODE === "stills"
        ? STILLS
        : Array.from({ length: Math.round(43.4 * FPS) }, (_, i) => i / FPS);

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      await send("Runtime.evaluate", {
        expression: `window.__seek(${t})`,
        awaitPromise: true,
      });
      const shot = await send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 90,
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const name =
        MODE === "stills"
          ? `${OUT_DIR}/still_${String(i).padStart(2, "0")}_${t.toFixed(1)}.jpg`
          : `${OUT_DIR}/frame_${String(i).padStart(5, "0")}.jpg`;
      writeFileSync(name, Buffer.from(shot.data, "base64"));
      if (i % 60 === 0 || MODE === "stills") {
        console.log(`${i + 1}/${times.length} ${name}`);
      }
    }
    ws.close();
    console.log("ok", times.length);
  } finally {
    chrome.kill("SIGKILL");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

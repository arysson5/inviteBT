/**
 * Servidor local: site estático + /api/rsvp + /api/presentes + /api/admin
 * Uso: npm run dev
 * Abra: http://localhost:3030/  ou  /rsvp.html  (sem Live Server / Go Live)
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const http = require("http");
const fs = require("fs");
const path = require("path");

const rsvpHandler = require("../api/rsvp.js");
const presentesHandler = require("../api/presentes.js");
const adminHandler = require("../api/admin.js");

const PORT = Number(process.env.RSVP_DEV_PORT || 3030);
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function readFullBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function prepareRequest(req) {
  const u = new URL(req.url, "http://127.0.0.1");
  req.query = Object.fromEntries(u.searchParams);
  const buf = await readFullBody(req);
  const ct = req.headers["content-type"] || "";
  if (buf.length && ct.includes("application/json")) {
    try {
      req.body = JSON.parse(buf.toString("utf8"));
    } catch {
      req.body = {};
    }
  } else {
    req.body = {};
  }
  req.url = u.pathname + u.search;
}

function isBlockedRelative(rel) {
  const parts = rel.split(/[/\\]/).filter(Boolean);
  if (parts.some((p) => p === ".." || p === "node_modules" || p === ".git")) {
    return true;
  }
  if (parts.some((p) => p.startsWith(".env"))) return true;
  return false;
}

function resolveStaticFile(urlPath) {
  let pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "" || pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
  const rel = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!rel || isBlockedRelative(rel)) return null;
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function sendStatic(req, res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Não encontrado");
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "HEAD") {
      res.writeHead(200);
      return res.end();
    }
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://127.0.0.1");
    const pathname = u.pathname;

    if (
      pathname === "/api/rsvp" ||
      pathname === "/api/presentes" ||
      pathname === "/api/admin"
    ) {
      const handler =
        pathname === "/api/rsvp"
          ? rsvpHandler
          : pathname === "/api/presentes"
            ? presentesHandler
            : adminHandler;
      await prepareRequest(req);
      await handler(req, res);
      return;
    }

    if (pathname.startsWith("/api/")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Rota API desconhecida." }));
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.setHeader("Allow", "GET, HEAD");
      return res.end("Method Not Allowed");
    }

    const filePath = resolveStaticFile(pathname);
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Proibido");
    }
    sendStatic(req, res, filePath);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Erro no servidor local." }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n  Site + API em http://localhost:${PORT}/`);
  console.log(`  Ex.: http://localhost:${PORT}/rsvp.html`);
  console.log(`       http://localhost:${PORT}/presentes.html\n`);
  console.log("  API: /api/rsvp  |  /api/presentes  |  /api/admin");
  console.log("  (Defina GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_SPREADSHEET_ID no .env)\n");
});

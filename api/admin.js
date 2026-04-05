/**
 * Painel admin: senha em ADMIN_DASHBOARD_PASSWORD (padrão casamentobt@123).
 * Authorization: Bearer <senha>
 */

const { readAllRows, listGuestsObjects } = require("../lib/sheetsConvidados");
const {
  readPresentesRows,
  readEscolhidosRows,
  listPresentesObjects,
  listEscolhidosObjects,
  appendPresenteRow,
  updatePresenteRow,
  deletePresenteCascade,
} = require("../lib/sheetsPresentesEscolhidos");

const CAPACIDADE_MAX = 120;

function getAdminPassword() {
  return process.env.ADMIN_DASHBOARD_PASSWORD || "casamentobt@123";
}

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID não configurado.");
  const convidadosSheet =
    process.env.RSVP_SHEET_NAME ||
    process.env.GOOGLE_SHEET_CONVIDADOS ||
    "convidados";
  const presentesSheet = process.env.SHEET_PRESENTES || "Presentes";
  const escolhidosSheet = process.env.SHEET_ESCOLHIDOS || "Escolhidos";
  return {
    spreadsheetId,
    convidadosSheet,
    presentesSheet,
    escolhidosSheet,
  };
}

function checkAuth(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return token === getAdminPassword();
}

function getAllowedOrigin(req) {
  const list = (process.env.RSVP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin || "";
  if (list.length === 0) return origin || "*";
  if (list.includes("*")) return "*";
  if (origin && list.includes(origin)) return origin;
  return list[0] || "*";
}

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function sumPessoasConvidados(values) {
  const guests = listGuestsObjects(values);
  let sum = 0;
  for (const g of guests) {
    const n = parseInt(String(g.count || "1"), 10);
    sum += Number.isNaN(n) || n < 1 ? 1 : n;
  }
  return sum;
}

async function buildOverview(spreadsheetId, sheets) {
  const [convVals, presVals, escVals] = await Promise.all([
    readAllRows(spreadsheetId, sheets.convidadosSheet),
    readPresentesRows(spreadsheetId, sheets.presentesSheet),
    readEscolhidosRows(spreadsheetId, sheets.escolhidosSheet),
  ]);

  const convidados = listGuestsObjects(convVals);
  const presents = listPresentesObjects(presVals);
  const choices = listEscolhidosObjects(escVals);
  const totalPessoas = sumPessoasConvidados(convVals);
  const nPresentes = presents.length;
  const nEscolhidos = choices.length;
  const pctPresentes =
    nPresentes > 0 ? Math.round((nEscolhidos / nPresentes) * 100) : 0;
  const pctCapacidade = Math.min(
    100,
    Math.round((totalPessoas / CAPACIDADE_MAX) * 100)
  );

  return {
    capacidadeMax: CAPACIDADE_MAX,
    totalPessoas,
    pctCapacidade,
    convidados,
    presents,
    choices,
    nPresentes,
    nEscolhidos,
    pctPresentes,
    nDisponiveis: Math.max(0, nPresentes - nEscolhidos),
  };
}

module.exports = async (req, res) => {
  let origin;
  try {
    origin = getAllowedOrigin(req);
    setCors(res, origin);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    const cfg = getConfig();

    if (req.method === "GET") {
      if (!checkAuth(req)) {
        return sendJson(res, 401, {
          ok: false,
          error: "Não autorizado. Informe a senha de administrador.",
        });
      }
      const overview = await buildOverview(cfg.spreadsheetId, cfg);
      return sendJson(res, 200, { ok: true, ...overview });
    }

    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      if (body.action === "login") {
        const pwd = String(body.password || "");
        if (pwd === getAdminPassword()) {
          return sendJson(res, 200, { ok: true });
        }
        return sendJson(res, 401, { ok: false, error: "Senha incorreta." });
      }

      if (!checkAuth(req)) {
        return sendJson(res, 401, {
          ok: false,
          error: "Não autorizado. Informe a senha de administrador.",
        });
      }

      const action = String(body.action || "");

      if (action === "add_presente") {
        const name = String(body.name || "").trim();
        if (!name) {
          return sendJson(res, 400, { ok: false, error: "Nome é obrigatório." });
        }
        const url = String(body.url || "").trim();
        const price = String(body.price || "").trim();
        const imageUrl = String(body.imageUrl || "").trim();
        await appendPresenteRow(cfg.spreadsheetId, cfg.presentesSheet, [
          name,
          url,
          price,
          imageUrl,
        ]);
        const overview = await buildOverview(cfg.spreadsheetId, cfg);
        return sendJson(res, 201, {
          ok: true,
          message: "Presente adicionado.",
          ...overview,
        });
      }

      if (action === "update_presente") {
        const originalName = String(body.originalName || "").trim();
        const name = String(body.name || "").trim();
        const url = String(body.url || "").trim();
        const price = String(body.price || "").trim();
        const imageUrl = String(body.imageUrl || "").trim();
        await updatePresenteRow(cfg.spreadsheetId, cfg, originalName, {
          name,
          url,
          price,
          imageUrl,
        });
        const overview = await buildOverview(cfg.spreadsheetId, cfg);
        return sendJson(res, 200, {
          ok: true,
          message: "Presente atualizado.",
          ...overview,
        });
      }

      if (action === "delete_presente") {
        const giftName = String(body.giftName || "").trim();
        await deletePresenteCascade(cfg.spreadsheetId, cfg, giftName);
        const overview = await buildOverview(cfg.spreadsheetId, cfg);
        return sendJson(res, 200, {
          ok: true,
          message: "Presente removido.",
          ...overview,
        });
      }

      return sendJson(res, 400, {
        ok: false,
        error:
          'Ação inválida. Use "login", "add_presente", "update_presente" ou "delete_presente".',
      });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return sendJson(res, 405, { ok: false, error: "Método não permitido." });
  } catch (err) {
    console.error("[api/admin]", err);
    const msg =
      err.message && typeof err.message === "string"
        ? err.message
        : "Erro interno.";
    if (origin) setCors(res, origin);
    return sendJson(res, 400, { ok: false, error: msg });
  }
};

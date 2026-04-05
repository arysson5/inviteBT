/**
 * Lista de presentes (aba Presentes) e escolhas (aba Escolhidos).
 * GET: estado público. POST: escolher | trocar | desmarcar | recuperar_sessao (só e-mail).
 */

const {
  getEstadoPublico,
  recuperarSessaoPresentes,
  escolherPresente,
  trocarPresente,
  desmarcarPresente,
} = require("../lib/sheetsPresentesEscolhidos");

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID não configurado.");
  }
  const convidadosSheet =
    process.env.RSVP_SHEET_NAME ||
    process.env.GOOGLE_SHEET_CONVIDADOS ||
    "convidados";
  const presentesSheet = process.env.SHEET_PRESENTES || "Presentes";
  const escolhidosSheet = process.env.SHEET_ESCOLHIDOS || "Escolhidos";
  return {
    spreadsheetId,
    sheets: { convidadosSheet, presentesSheet, escolhidosSheet },
  };
}

function getAllowedOrigin(req) {
  const list = (process.env.RSVP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin || "";
  if (list.length === 0) {
    return origin || "*";
  }
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

module.exports = async (req, res) => {
  let origin;
  try {
    const { spreadsheetId, sheets } = getConfig();
    origin = getAllowedOrigin(req);
    setCors(res, origin);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method === "GET") {
      const estado = await getEstadoPublico(spreadsheetId, sheets);
      return sendJson(res, 200, { ok: true, ...estado });
    }

    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      const action = String(body.action || "").toLowerCase();
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const name = String(body.name || "").trim();

      if (action === "escolher") {
        await escolherPresente(
          spreadsheetId,
          sheets,
          {
            email,
            name,
            giftName: body.giftName,
          }
        );
        return sendJson(res, 201, {
          ok: true,
          message: "Presente registrado com sucesso!",
        });
      }

      if (action === "trocar") {
        await trocarPresente(spreadsheetId, sheets, {
          email,
          name,
          newGiftName: body.newGiftName,
        });
        return sendJson(res, 200, { ok: true, message: "Presente atualizado." });
      }

      if (action === "desmarcar") {
        await desmarcarPresente(spreadsheetId, sheets, {
          email,
          giftName: body.giftName,
        });
        return sendJson(res, 200, { ok: true, message: "Escolha removida." });
      }

      if (action === "recuperar_sessao") {
        if (!email) {
          return sendJson(res, 400, {
            ok: false,
            error: "Informe o e-mail usado na confirmação de presença.",
          });
        }
        const info = await recuperarSessaoPresentes(
          spreadsheetId,
          sheets,
          email
        );
        return sendJson(res, 200, { ok: true, ...info });
      }

      return sendJson(res, 400, {
        ok: false,
        error:
          'Ação inválida. Use "escolher", "trocar", "desmarcar" ou "recuperar_sessao".',
      });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return sendJson(res, 405, { ok: false, error: "Método não permitido." });
  } catch (err) {
    console.error("[api/presentes]", err);
    const msg =
      err.message && typeof err.message === "string"
        ? err.message
        : "Erro interno.";
    if (origin) setCors(res, origin);
    return sendJson(res, 400, { ok: false, error: msg });
  }
};

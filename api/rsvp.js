/**
 * API RSVP / CRUD da aba de convidados (service account).
 * POST público: uma pessoa (nome, e-mail; quantidade fixa 1 no fluxo do site) → 1 linha na aba convidados.
 * Formato legado: guests[] (1–2 linhas com nome+email cada).
 * GET / PATCH / DELETE: cabeçalho Authorization: Bearer <RSVP_ADMIN_SECRET>
 */

const {
  readAllRows,
  appendGuests,
  updateGuest,
  deleteGuest,
  listGuestsObjects,
  emailExists,
} = require("../lib/sheetsConvidados");
const { notifyRsvpEmailJs } = require("../lib/emailjsNotify");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const sheetName =
    process.env.RSVP_SHEET_NAME || process.env.GOOGLE_SHEET_CONVIDADOS || "convidados";
  const adminSecret = process.env.RSVP_ADMIN_SECRET || "";
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID não configurado.");
  }
  return { spreadsheetId, sheetName, adminSecret };
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
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

function isAdmin(req, adminSecret) {
  if (!adminSecret) return false;
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return token === adminSecret;
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

function normalizeGuest(g) {
  const name = String(g.name || "").trim();
  const email = String(g.email || "")
    .trim()
    .toLowerCase();
  let count = parseInt(String(g.count != null ? g.count : "1"), 10);
  if (Number.isNaN(count) || count < 1) count = 1;
  if (count > 50) count = 50;
  return { name, email, count: String(count) };
}

function validateGuest(g) {
  if (!g.name || g.name.length > 200) {
    return "Nome é obrigatório (máx. 200 caracteres).";
  }
  if (!g.email || !EMAIL_RE.test(g.email)) {
    return "E-mail inválido.";
  }
  return null;
}

const NAME_CELL_MAX = 500;

module.exports = async (req, res) => {
  let origin;
  try {
    const { spreadsheetId, sheetName, adminSecret } = getConfig();
    origin = getAllowedOrigin(req);
    setCors(res, origin);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method === "POST") {
      const body = await parseJsonBody(req);

      if (body.titular && typeof body.titular === "object") {
        const t = normalizeGuest(body.titular);
        const errT = validateGuest(t);
        if (errT) {
          return sendJson(res, 400, { ok: false, error: errT });
        }
        const countNum = parseInt(t.count, 10);
        if (countNum < 1) {
          return sendJson(res, 400, {
            ok: false,
            error: "Quantidade deve ser pelo menos 1.",
          });
        }
        const blockDup =
          (process.env.RSVP_BLOCK_DUPLICATE_EMAIL || "true").toLowerCase() !==
          "false";
        if (blockDup && (await emailExists(spreadsheetId, sheetName, t.email))) {
          return sendJson(res, 409, {
            ok: false,
            error:
              "Este e-mail já está na lista. Use outro e-mail ou peça ajuda aos noivos.",
          });
        }
        const nameCell = t.name.slice(0, NAME_CELL_MAX);
        await appendGuests(spreadsheetId, sheetName, [
          [nameCell, t.email, t.count],
        ]);
        try {
          await notifyRsvpEmailJs({ name: nameCell, email: t.email });
        } catch (emErr) {
          console.error("[api/rsvp] EmailJS:", emErr.message || emErr);
        }
        return sendJson(res, 201, {
          ok: true,
          message: "Presença registrada com sucesso!",
          added: 1,
        });
      }

      const guestsIn = Array.isArray(body.guests) ? body.guests : [];
      if (guestsIn.length < 1 || guestsIn.length > 2) {
        return sendJson(res, 400, {
          ok: false,
          error:
            "Envie { titular: { name, email, count } } ou, no formato antigo, guests[].",
        });
      }
      const guests = guestsIn.map(normalizeGuest);
      const emails = guests.map((g) => g.email);
      if (new Set(emails).size !== emails.length) {
        return sendJson(res, 400, {
          ok: false,
          error: "Os e-mails dos convidados não podem ser repetidos.",
        });
      }
      for (const g of guests) {
        const err = validateGuest(g);
        if (err) {
          return sendJson(res, 400, { ok: false, error: err });
        }
      }
      const blockDupLegacy =
        (process.env.RSVP_BLOCK_DUPLICATE_EMAIL || "true").toLowerCase() !==
        "false";
      if (blockDupLegacy) {
        for (const g of guests) {
          if (await emailExists(spreadsheetId, sheetName, g.email)) {
            return sendJson(res, 409, {
              ok: false,
              error:
                "Um dos e-mails informados já está na lista. Use outro e-mail ou peça ajuda aos noivos.",
            });
          }
        }
      }
      const rows = guests.map((g) => [g.name, g.email, g.count]);
      await appendGuests(spreadsheetId, sheetName, rows);
      try {
        for (const g of guests) {
          await notifyRsvpEmailJs({
            name: g.name.slice(0, NAME_CELL_MAX),
            email: g.email,
          });
        }
      } catch (emErr) {
        console.error("[api/rsvp] EmailJS:", emErr.message || emErr);
      }
      return sendJson(res, 201, {
        ok: true,
        message: "Presença registrada com sucesso!",
        added: guests.length,
      });
    }

    if (!isAdmin(req, adminSecret)) {
      return sendJson(res, 401, {
        ok: false,
        error: "Não autorizado.",
      });
    }

    if (req.method === "GET") {
      const values = await readAllRows(spreadsheetId, sheetName);
      const guests = listGuestsObjects(values);
      return sendJson(res, 200, { ok: true, sheetName, guests });
    }

    if (req.method === "PATCH") {
      const body = await parseJsonBody(req);
      const lookupEmail = String(body.lookupEmail || "")
        .trim()
        .toLowerCase();
      if (!lookupEmail) {
        return sendJson(res, 400, {
          ok: false,
          error: "Informe lookupEmail (e-mail atual da linha a alterar).",
        });
      }
      const patch = {};
      if (body.name != null) patch.name = body.name;
      if (body.count != null) patch.count = body.count;
      if (body.newEmail != null) {
        patch.email = String(body.newEmail).trim().toLowerCase();
      }
      if (Object.keys(patch).length === 0) {
        return sendJson(res, 400, {
          ok: false,
          error: "Nada para atualizar (name, count ou newEmail).",
        });
      }
      if (patch.email && !EMAIL_RE.test(patch.email)) {
        return sendJson(res, 400, {
          ok: false,
          error: "newEmail inválido.",
        });
      }
      await updateGuest(spreadsheetId, sheetName, lookupEmail, patch);
      return sendJson(res, 200, { ok: true, message: "Atualizado." });
    }

    if (req.method === "DELETE") {
      const url = new URL(
        req.url || "/",
        `http://${req.headers.host || "localhost"}`
      );
      let email =
        url.searchParams.get("email") ||
        (req.query && typeof req.query.email === "string"
          ? req.query.email
          : "");
      if (!email) {
        try {
          const body = await parseJsonBody(req);
          email = body.email || "";
        } catch {
          email = "";
        }
      }
      email = String(email).trim().toLowerCase();
      if (!email) {
        return sendJson(res, 400, {
          ok: false,
          error: "Informe email na query (?email=) ou no corpo JSON.",
        });
      }
      await deleteGuest(spreadsheetId, sheetName, email);
      return sendJson(res, 200, { ok: true, message: "Removido." });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
    return sendJson(res, 405, { ok: false, error: "Método não permitido." });
  } catch (err) {
    console.error("[api/rsvp]", err);
    const msg =
      err.message && typeof err.message === "string"
        ? err.message
        : "Erro interno.";
    if (origin) setCors(res, origin);
    return sendJson(res, 500, { ok: false, error: msg });
  }
};

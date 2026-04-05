/**
 * Cliente Google Sheets (JWT service account) compartilhado.
 */

const { google } = require("googleapis");

/**
 * Corrige JSON vindo do .env: BOM e aspas externas em volta do objeto ({...}).
 */
function normalizeCredentialsJsonString(s) {
  let t = String(s).trim().replace(/^\uFEFF/, "");
  for (let i = 0; i < 3; i++) {
    if (
      t.length >= 2 &&
      (t[0] === "'" || t[0] === '"') &&
      t[0] === t[t.length - 1]
    ) {
      const inner = t.slice(1, -1).trim();
      if (inner.startsWith("{")) {
        t = inner;
        continue;
      }
    }
    break;
  }
  return t;
}

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!raw && !b64) {
    throw new Error(
      "Defina GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_JSON_B64 no ambiente."
    );
  }
  const json = raw
    ? normalizeCredentialsJsonString(raw)
    : Buffer.from(b64, "base64").toString("utf8");
  let credentials;
  try {
    credentials = JSON.parse(json);
  } catch (e) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido. Coloque o arquivo .json inteiro em uma linha no .env (ex.: GOOGLE_SERVICE_ACCOUNT_JSON={\"type\":\"service_account\",...}) sem aspas simples envolvendo o objeto. Detalhe: " +
        (e.message || e)
    );
  }
  if (credentials.private_key) {
    credentials.private_key = String(credentials.private_key).replace(
      /\\n/g,
      "\n"
    );
  }
  return credentials;
}

function getAuth() {
  const credentials = parseServiceAccount();
  return new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function escapeSheetTitle(title) {
  return title.replace(/'/g, "''");
}

function a1Range(sheetName, a1) {
  return `'${escapeSheetTitle(sheetName)}'!${a1}`;
}

async function getSheetId(spreadsheetId, sheetName) {
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sh = meta.data.sheets.find(
    (s) => s.properties.title === sheetName
  );
  if (!sh) {
    throw new Error(`Aba "${sheetName}" não encontrada na planilha.`);
  }
  return sh.properties.sheetId;
}

module.exports = {
  getSheets,
  a1Range,
  getSheetId,
};

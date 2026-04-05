/**
 * Abas Presentes (Nome, URL, Preço, Foto) e Escolhidos (Email, Nome, Presente).
 */

const { getSheets, a1Range, getSheetId } = require("./googleSheetClient");
const { readAllRows, findDataRowIndexByEmail } = require("./sheetsConvidados");

function normEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

async function readPresentesRows(spreadsheetId, sheetName) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1Range(sheetName, "A:D"),
  });
  return res.data.values || [];
}

function listPresentesObjects(values) {
  if (values.length <= 1) return [];
  return values
    .slice(1)
    .map((row, i) => ({
      id: i + 1,
      name: String(row[0] || "").trim(),
      url: String(row[1] || "").trim(),
      price: String(row[2] || "").trim(),
      imageUrl: String(row[3] || "").trim(),
    }))
    .filter((g) => g.name);
}

async function readEscolhidosRows(spreadsheetId, sheetName) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1Range(sheetName, "A:C"),
  });
  return res.data.values || [];
}

/** Índice da linha em Escolhidos onde coluna A = email (0-based, 0 = cabeçalho). */
function findEscolhidoRowIndexByEmail(values, email) {
  const e = normEmail(email);
  for (let i = 1; i < values.length; i++) {
    if (normEmail(values[i][0]) === e) return i;
  }
  return -1;
}

function listEscolhidosObjects(values) {
  if (values.length <= 1) return [];
  return values
    .slice(1)
    .map((row) => ({
      guestEmail: normEmail(row[0]),
      guestName: String(row[1] || "").trim(),
      giftName: String(row[2] || "").trim(),
    }))
    .filter((r) => r.guestEmail && r.giftName);
}

function giftNameTakenByOther(values, giftName, exceptEmail) {
  const g = String(giftName || "").trim();
  const ex = normEmail(exceptEmail);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][2] || "").trim() === g) {
      if (normEmail(values[i][0]) !== ex) return true;
    }
  }
  return false;
}

async function appendEscolhido(spreadsheetId, sheetName, row) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1Range(sheetName, "A:C"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [row] },
  });
}

async function updateEscolhidoRow(
  spreadsheetId,
  sheetName,
  rowIndex0Based,
  email,
  name,
  giftName
) {
  const rowNum = rowIndex0Based + 1;
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1Range(sheetName, `A${rowNum}:C${rowNum}`),
    valueInputOption: "USER_ENTERED",
    resource: { values: [[email, name, giftName]] },
  });
}

async function deleteRowByIndex(spreadsheetId, sheetName, rowIndex0Based) {
  const sheetId = await getSheetId(spreadsheetId, sheetName);
  const sheets = getSheets();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex0Based,
              endIndex: rowIndex0Based + 1,
            },
          },
        },
      ],
    },
  });
}

function presenteExists(presentesValues, giftName) {
  const g = String(giftName || "").trim();
  const names = new Set();
  for (let i = 1; i < presentesValues.length; i++) {
    const n = String(presentesValues[i][0] || "").trim();
    if (n) names.add(n);
  }
  return names.has(g);
}

async function escolherPresente(
  spreadsheetId,
  { convidadosSheet, presentesSheet, escolhidosSheet },
  { email, name, giftName }
) {
  const em = normEmail(email);
  const nm = String(name || "").trim();
  const gift = String(giftName || "").trim();
  if (!em || !nm || !gift) {
    throw new Error("E-mail, nome e presente são obrigatórios.");
  }

  const conv = await readAllRows(spreadsheetId, convidadosSheet);
  if (findDataRowIndexByEmail(conv, em) < 0) {
    throw new Error(
      "Este e-mail não está na lista de confirmados. Confirme sua presença primeiro."
    );
  }

  const esc = await readEscolhidosRows(spreadsheetId, escolhidosSheet);
  if (findEscolhidoRowIndexByEmail(esc, em) >= 0) {
    throw new Error("Você já escolheu um presente.");
  }

  const pres = await readPresentesRows(spreadsheetId, presentesSheet);
  if (!presenteExists(pres, gift)) {
    throw new Error("Presente não encontrado na lista.");
  }
  if (giftNameTakenByOther(esc, gift, em)) {
    throw new Error("Este presente já foi escolhido por outro convidado.");
  }

  await appendEscolhido(spreadsheetId, escolhidosSheet, [em, nm, gift]);
}

async function trocarPresente(
  spreadsheetId,
  { presentesSheet, escolhidosSheet },
  { email, name, newGiftName }
) {
  const em = normEmail(email);
  const nm = String(name || "").trim();
  const gift = String(newGiftName || "").trim();
  if (!em || !gift) {
    throw new Error("E-mail e novo presente são obrigatórios.");
  }

  const esc = await readEscolhidosRows(spreadsheetId, escolhidosSheet);
  const idx = findEscolhidoRowIndexByEmail(esc, em);
  if (idx < 0) {
    throw new Error("Nenhuma escolha encontrada para este e-mail.");
  }

  const pres = await readPresentesRows(spreadsheetId, presentesSheet);
  if (!presenteExists(pres, gift)) {
    throw new Error("Presente não encontrado na lista.");
  }
  if (giftNameTakenByOther(esc, gift, em)) {
    throw new Error("Este presente já foi escolhido por outro convidado.");
  }

  await updateEscolhidoRow(
    spreadsheetId,
    escolhidosSheet,
    idx,
    em,
    nm || String(esc[idx][1] || "").trim(),
    gift
  );
}

async function desmarcarPresente(
  spreadsheetId,
  { escolhidosSheet },
  { email, giftName }
) {
  const em = normEmail(email);
  const gift = String(giftName || "").trim();
  const esc = await readEscolhidosRows(spreadsheetId, escolhidosSheet);
  const idx = findEscolhidoRowIndexByEmail(esc, em);
  if (idx < 0) {
    throw new Error("Nenhuma escolha encontrada para este e-mail.");
  }
  if (String(esc[idx][2] || "").trim() !== gift) {
    throw new Error("Este não é o presente registrado para você.");
  }
  await deleteRowByIndex(spreadsheetId, escolhidosSheet, idx);
}

async function getEstadoPublico(
  spreadsheetId,
  { presentesSheet, escolhidosSheet }
) {
  const pres = await readPresentesRows(spreadsheetId, presentesSheet);
  const esc = await readEscolhidosRows(spreadsheetId, escolhidosSheet);
  return {
    presents: listPresentesObjects(pres),
    choices: listEscolhidosObjects(esc),
  };
}

/**
 * Valida e-mail na aba convidados e devolve nome + presente escolhido (se houver).
 */
async function recuperarSessaoPresentes(
  spreadsheetId,
  { convidadosSheet, escolhidosSheet },
  rawEmail
) {
  const em = normEmail(rawEmail);
  if (!em) {
    throw new Error("Informe um e-mail válido.");
  }

  const conv = await readAllRows(spreadsheetId, convidadosSheet);
  const idx = findDataRowIndexByEmail(conv, em);
  if (idx < 0) {
    throw new Error(
      "Não encontramos este e-mail entre os confirmados. Confirme sua presença antes."
    );
  }

  const name = String(conv[idx][0] || "").trim();
  if (!name) {
    throw new Error(
      "Não foi possível recuperar seu nome. Entre em contato com os noivos."
    );
  }

  const esc = await readEscolhidosRows(spreadsheetId, escolhidosSheet);
  const escIdx = findEscolhidoRowIndexByEmail(esc, em);
  let giftName = null;
  if (escIdx >= 0) {
    const g = String(esc[escIdx][2] || "").trim();
    giftName = g || null;
  }

  return { name, email: em, giftName };
}

async function appendPresenteRow(spreadsheetId, sheetName, row) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1Range(sheetName, "A:D"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [row] },
  });
}

/**
 * Atualiza linha na aba Presentes (A:D). Se o nome mudar, atualiza col. C em Escolhidos.
 */
async function updatePresenteRow(
  spreadsheetId,
  { presentesSheet, escolhidosSheet },
  originalName,
  { name, url, price, imageUrl }
) {
  const oldG = String(originalName || "").trim();
  const newG = String(name || "").trim();
  const u = String(url || "").trim();
  const pr = String(price || "").trim();
  const img = String(imageUrl || "").trim();
  if (!oldG) throw new Error("Nome original é obrigatório.");
  if (!newG) throw new Error("Nome é obrigatório.");

  const presData = await readPresentesRows(spreadsheetId, presentesSheet);
  let rowIdx = -1;
  for (let i = 1; i < presData.length; i++) {
    if (String(presData[i][0] || "").trim() === oldG) {
      rowIdx = i;
      break;
    }
  }
  if (rowIdx < 0) {
    throw new Error('Presente "' + oldG + '" não encontrado.');
  }

  if (newG !== oldG) {
    for (let i = 1; i < presData.length; i++) {
      if (
        i !== rowIdx &&
        String(presData[i][0] || "").trim() === newG
      ) {
        throw new Error('Já existe um presente com o nome "' + newG + '".');
      }
    }
  }

  const sheets = getSheets();
  const sheetRow = rowIdx + 1;
  const range = a1Range(
    presentesSheet,
    `A${sheetRow}:D${sheetRow}`
  );
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    resource: { values: [[newG, u, pr, img]] },
  });

  if (newG !== oldG) {
    const escData = await readEscolhidosRows(spreadsheetId, escolhidosSheet);
    const data = [];
    for (let i = 1; i < escData.length; i++) {
      if (String(escData[i][2] || "").trim() === oldG) {
        data.push({
          range: a1Range(escolhidosSheet, `C${i + 1}`),
          values: [[newG]],
        });
      }
    }
    if (data.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: "USER_ENTERED",
          data,
        },
      });
    }
  }
}

/**
 * Remove linhas do presente na aba Presentes e escolhas na Escolhidos (nome exato col. A / C).
 */
async function deletePresenteCascade(
  spreadsheetId,
  { presentesSheet, escolhidosSheet },
  giftName
) {
  const g = String(giftName || "").trim();
  if (!g) throw new Error("Nome do presente é obrigatório.");

  const presentsSheetId = await getSheetId(spreadsheetId, presentesSheet);
  const escSheetId = await getSheetId(spreadsheetId, escolhidosSheet);
  const sheets = getSheets();

  const presData = await readPresentesRows(spreadsheetId, presentesSheet);
  const escData = await readEscolhidosRows(spreadsheetId, escolhidosSheet);

  const escReq = [];
  for (let i = escData.length - 1; i >= 1; i--) {
    if (String(escData[i][2] || "").trim() === g) {
      escReq.push({
        deleteDimension: {
          range: {
            sheetId: escSheetId,
            dimension: "ROWS",
            startIndex: i,
            endIndex: i + 1,
          },
        },
      });
    }
  }

  const presReq = [];
  for (let i = presData.length - 1; i >= 1; i--) {
    if (String(presData[i][0] || "").trim() === g) {
      presReq.push({
        deleteDimension: {
          range: {
            sheetId: presentsSheetId,
            dimension: "ROWS",
            startIndex: i,
            endIndex: i + 1,
          },
        },
      });
    }
  }

  if (escReq.length === 0 && presReq.length === 0) {
    throw new Error('Presente "' + g + '" não encontrado.');
  }

  if (escReq.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: escReq },
    });
  }
  if (presReq.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: presReq },
    });
  }
}

module.exports = {
  readPresentesRows,
  readEscolhidosRows,
  listPresentesObjects,
  listEscolhidosObjects,
  escolherPresente,
  trocarPresente,
  desmarcarPresente,
  getEstadoPublico,
  recuperarSessaoPresentes,
  appendPresenteRow,
  updatePresenteRow,
  deletePresenteCascade,
};

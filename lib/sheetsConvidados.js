/**
 * Aba convidados (Nome | Email | Quantidade).
 */

const { getSheets, a1Range, getSheetId } = require("./googleSheetClient");

async function readAllRows(spreadsheetId, sheetName) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1Range(sheetName, "A:C"),
  });
  return res.data.values || [];
}

async function appendGuests(spreadsheetId, sheetName, rows) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1Range(sheetName, "A:C"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: { values: rows },
  });
}

function findDataRowIndexByEmail(values, email) {
  const e = String(email).trim().toLowerCase();
  for (let i = 1; i < values.length; i++) {
    const rowEmail = String(values[i][1] || "")
      .trim()
      .toLowerCase();
    if (rowEmail === e) return i;
  }
  return -1;
}

async function updateGuest(spreadsheetId, sheetName, lookupEmail, patch) {
  const values = await readAllRows(spreadsheetId, sheetName);
  const idx = findDataRowIndexByEmail(values, lookupEmail);
  if (idx < 0) throw new Error("Convidado não encontrado.");
  const rowNum = idx + 1;
  const cur = values[idx];
  const newName =
    patch.name != null ? String(patch.name).trim() : String(cur[0] || "");
  const newEmail =
    patch.email != null
      ? String(patch.email).trim().toLowerCase()
      : String(cur[1] || "").trim().toLowerCase();
  const newCount =
    patch.count != null ? String(patch.count) : String(cur[2] || "1");
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1Range(sheetName, `A${rowNum}:C${rowNum}`),
    valueInputOption: "USER_ENTERED",
    resource: { values: [[newName, newEmail, newCount]] },
  });
}

async function deleteGuest(spreadsheetId, sheetName, email) {
  const values = await readAllRows(spreadsheetId, sheetName);
  const idx = findDataRowIndexByEmail(values, email);
  if (idx < 0) throw new Error("Convidado não encontrado.");
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
              startIndex: idx,
              endIndex: idx + 1,
            },
          },
        },
      ],
    },
  });
}

function listGuestsObjects(values) {
  if (values.length <= 1) return [];
  return values.slice(1).map((row, i) => ({
    row: i + 2,
    name: String(row[0] || "").trim(),
    email: String(row[1] || "").trim().toLowerCase(),
    count: String(row[2] != null && row[2] !== "" ? row[2] : "1"),
  }));
}

async function emailExists(spreadsheetId, sheetName, email) {
  const values = await readAllRows(spreadsheetId, sheetName);
  return findDataRowIndexByEmail(values, email) >= 0;
}

module.exports = {
  readAllRows,
  appendGuests,
  updateGuest,
  deleteGuest,
  findDataRowIndexByEmail,
  listGuestsObjects,
  emailExists,
};

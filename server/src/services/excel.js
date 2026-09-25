import ExcelJS from "exceljs";

/**
 * Renders real structured worksheet cells (not an HTML/image dump) for a
 * titled table report, mirroring the shape already used by renderTablePdf
 * and toCsv so all three exports stay in sync.
 */
export async function renderTableXlsx({ title, columns, rows, sheetName = "Report" }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MedTrain";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ rightToLeft: false }],
  });

  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.min(Math.max(c.label.length + 4, 12), 40),
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4F3" } };

  for (const row of rows) {
    sheet.addRow(columns.reduce((acc, c) => ({ ...acc, [c.key]: row[c.key] ?? "" }), {}));
  }

  if (title) {
    sheet.insertRow(1, [title]);
    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.getRow(2).font = { bold: true };
    sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4F3" } };
  }

  return workbook.xlsx.writeBuffer();
}

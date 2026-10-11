import { strToU8, zipSync } from 'fflate';

/** Number formats of numeric cells; dates/times are Excel serial day numbers. */
export type XlsxNumberFormat = 'date' | 'time' | 'duration' | 'decimal';

export type XlsxCell = string | { value: number; format: XlsxNumberFormat } | null;

export interface XlsxColumn {
  header: string;
  /** Width in characters. */
  width: number;
}

// cellXfs indices in STYLES_XML
const HEADER_STYLE = 1;
const FORMAT_STYLE: Record<XlsxNumberFormat, number> = {
  date: 2,
  time: 3,
  duration: 4,
  decimal: 5,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Excel serial day number of 1970-01-01
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

/** Excel serial day number for a timestamp, in local time. */
export const toExcelDateTime = (ts: number): number => {
  const tzOffsetMs = new Date(ts).getTimezoneOffset() * 60 * 1000;
  const localDays = (ts - tzOffsetMs) / MS_PER_DAY;
  return localDays + EXCEL_EPOCH_OFFSET_DAYS;
};

/** Duration in Excel days, for the `duration` format. */
export const toExcelDuration = (ms: number): number => ms / MS_PER_DAY;

/** Creates a workbook with a single sheet: a bold header row, then the rows. */
export const createXlsx = (
  sheetName: string,
  columns: XlsxColumn[],
  rows: XlsxCell[][],
): Uint8Array => {
  /* eslint-disable @typescript-eslint/naming-convention */
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES_XML),
    '_rels/.rels': strToU8(ROOT_RELS_XML),
    'xl/workbook.xml': strToU8(getWorkbookXml(sheetName)),
    'xl/_rels/workbook.xml.rels': strToU8(WORKBOOK_RELS_XML),
    'xl/styles.xml': strToU8(STYLES_XML),
    'xl/worksheets/sheet1.xml': strToU8(getSheetXml(columns, rows)),
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  return zipSync(files);
};

const getSheetXml = (columns: XlsxColumn[], rows: XlsxCell[][]): string => {
  const cols = columns
    .map(
      (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`,
    )
    .join('');
  const headerRow = getRowXml(
    1,
    columns.map((c) => c.header),
    HEADER_STYLE,
  );
  const dataRows = rows.map((row, i) => getRowXml(i + 2, row)).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${headerRow}${dataRows}</sheetData>` +
    '</worksheet>'
  );
};

const getRowXml = (rowNr: number, cells: XlsxCell[], style?: number): string =>
  `<row r="${rowNr}">${cells
    .map((cell, i) => getCellXml(`${getColumnName(i)}${rowNr}`, cell, style))
    .join('')}</row>`;

const getCellXml = (ref: string, cell: XlsxCell, style?: number): string => {
  const styleAttr = style ? ` s="${style}"` : '';
  if (cell === null || cell === '') {
    return '';
  }
  if (typeof cell === 'string') {
    return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
  }
  return `<c r="${ref}" s="${FORMAT_STYLE[cell.format]}"><v>${cell.value}</v></c>`;
};

/** 0 => A, 25 => Z, 26 => AA */
export const getColumnName = (index: number): string => {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
};

const escapeXml = (str: string): string =>
  str
    // characters not allowed in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getWorkbookXml = (sheetName: string): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
  '</workbook>';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

// cellXfs: 0 default, 1 bold header, 2 date, 3 time, 4 duration, 5 decimal
const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="3">' +
  '<numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>' +
  '<numFmt numFmtId="165" formatCode="hh:mm"/>' +
  '<numFmt numFmtId="166" formatCode="[h]:mm"/>' +
  '</numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

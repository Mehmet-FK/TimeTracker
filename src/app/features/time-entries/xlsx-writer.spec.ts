import { strFromU8, unzipSync } from 'fflate';
import {
  createXlsx,
  getColumnName,
  toExcelDateTime,
  toExcelDuration,
} from './xlsx-writer';

describe('xlsx-writer', () => {
  it('getColumnName', () => {
    expect(getColumnName(0)).toBe('A');
    expect(getColumnName(25)).toBe('Z');
    expect(getColumnName(26)).toBe('AA');
    expect(getColumnName(27)).toBe('AB');
  });

  it('toExcelDateTime uses local time', () => {
    const noon = new Date(2026, 9, 10, 12, 0).getTime();
    const utcDays = Date.UTC(2026, 9, 10) / (24 * 60 * 60 * 1000);
    const expected = utcDays + 25569.5;
    expect(toExcelDateTime(noon)).toBeCloseTo(expected, 8);
  });

  it('toExcelDuration converts to days', () => {
    expect(toExcelDuration(36 * 60 * 60 * 1000)).toBe(1.5);
  });

  it('creates a zipped workbook with header, strings and formatted numbers', () => {
    const data = createXlsx(
      'Sheet & more',
      [
        { header: 'Name', width: 10 },
        { header: 'Value', width: 8 },
      ],
      [
        ['a < b & "c"', { value: 1.5, format: 'decimal' }],
        [null, { value: 0.25, format: 'duration' }],
      ],
    );

    const files = unzipSync(data);
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="Sheet &amp; more"');

    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain(
      '<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Name</t></is></c>',
    );
    expect(sheet).toContain('<t xml:space="preserve">a &lt; b &amp; &quot;c&quot;</t>');
    expect(sheet).toContain('<c r="B2" s="5"><v>1.5</v></c>');
    // empty cells are left out
    expect(sheet).toContain('<row r="3"><c r="B3" s="4"><v>0.25</v></c></row>');
  });
});

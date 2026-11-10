import { isValidIconUrl, validateModule } from './module.validator';

describe('module validator', () => {
  it('accepts a name only', () => {
    expect(validateModule({ name: 'Billing' })).toEqual([]);
  });

  it('accepts name, description and an https icon url', () => {
    expect(
      validateModule({
        name: 'Billing',
        description: 'Invoices',
        iconUrl: 'https://example.com/icon.png',
      }),
    ).toEqual([]);
  });

  it('rejects an empty name', () => {
    expect(validateModule({ name: '' })).toEqual(['NAME_REQUIRED']);
  });

  it('rejects a whitespace-only name', () => {
    expect(validateModule({ name: '   ' })).toEqual(['NAME_REQUIRED']);
  });

  it('rejects a non-URL iconUrl', () => {
    expect(validateModule({ name: 'A', iconUrl: 'not a url' })).toEqual([
      'ICON_URL_INVALID',
    ]);
  });

  it('rejects non-http protocols', () => {
    expect(isValidIconUrl('javascript:alert(1)')).toBe(false);
    expect(isValidIconUrl('ftp://example.com/a.png')).toBe(false);
  });

  it('accepts http and https urls', () => {
    expect(isValidIconUrl('http://example.com/a.png')).toBe(true);
    expect(isValidIconUrl('https://example.com/a.png')).toBe(true);
  });

  it('reports both errors', () => {
    expect(validateModule({ name: '', iconUrl: 'x' })).toEqual([
      'NAME_REQUIRED',
      'ICON_URL_INVALID',
    ]);
  });
});

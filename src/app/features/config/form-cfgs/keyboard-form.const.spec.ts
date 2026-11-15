import { KEYBOARD_SETTINGS_FORM_CFG } from './keyboard-form.const';
import { DEFAULT_GLOBAL_CONFIG } from '../default-global-config.const';

describe('KEYBOARD_SETTINGS_FORM_CFG', () => {
  const fieldKeys = (): string[] =>
    (KEYBOARD_SETTINGS_FORM_CFG.items ?? [])
      .map((item): unknown => item.key)
      .filter((key): key is string => typeof key === 'string');

  it('has no focus mode shortcut (removed in TT-42)', () => {
    expect(fieldKeys()).not.toContain('goToFocusMode');
    expect('goToFocusMode' in DEFAULT_GLOBAL_CONFIG.keyboard).toBe(false);
  });

  it('still offers the navigation shortcuts', () => {
    expect(fieldKeys()).toEqual(
      jasmine.arrayContaining(['goToWorkView', 'goToTimeline', 'goToSettings']),
    );
  });
});

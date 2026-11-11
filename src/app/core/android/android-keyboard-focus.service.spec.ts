import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AndroidKeyboardFocusService } from './android-keyboard-focus.service';

describe('AndroidKeyboardFocusService', () => {
  let service: AndroidKeyboardFocusService;
  let input: HTMLInputElement;

  beforeEach(() => {
    service = TestBed.inject(AndroidKeyboardFocusService);
    input = document.createElement('input');
    document.body.appendChild(input);
    spyOn(input, 'scrollIntoView');
  });

  afterEach(() => input.remove());

  it('does nothing outside the Android WebView', fakeAsync(() => {
    service.init(false);
    input.focus();
    tick(500);
    expect(input.scrollIntoView).not.toHaveBeenCalled();
  }));

  it('scrolls a focused text field into view on Android', fakeAsync(() => {
    service.init(true);
    input.focus();
    tick(500);
    expect(input.scrollIntoView).toHaveBeenCalledTimes(1);
  }));

  it('scrolls the focused field again after the keyboard resizes the window', fakeAsync(() => {
    service.init(true);
    input.focus();
    tick(500);
    window.dispatchEvent(new Event('resize'));
    expect(input.scrollIntoView).toHaveBeenCalledTimes(2);
  }));
});

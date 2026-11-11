import { DOCUMENT, inject, Injectable, OnDestroy } from '@angular/core';
import { IS_ANDROID_WEB_VIEW } from '../../util/is-android-web-view';

const TEXT_FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
// the IME animation resizes the WebView (adjustResize) a moment after focusin
const RESIZE_SETTLE_MS = 300;

/**
 * Android: with `adjustResize` the WebView shrinks when the on-screen keyboard
 * opens, but the focused field is not always scrolled into the smaller area.
 * This scrolls it into view after focus and after the resize.
 */
@Injectable({ providedIn: 'root' })
export class AndroidKeyboardFocusService implements OnDestroy {
  private readonly _document = inject(DOCUMENT);
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _isInitialized = false;
  private readonly _abort = new AbortController();

  init(isAndroid: boolean = IS_ANDROID_WEB_VIEW): void {
    if (!isAndroid || this._isInitialized) {
      return;
    }
    this._isInitialized = true;
    const { signal } = this._abort;
    this._document.addEventListener('focusin', (ev) => this._onFocusIn(ev), {
      passive: true,
      signal,
    });
    this._document.defaultView?.addEventListener('resize', () => this._scrollActive(), {
      signal,
    });
  }

  ngOnDestroy(): void {
    this._abort.abort();
    clearTimeout(this._timer);
  }

  private _onFocusIn(ev: Event): void {
    if (!(ev.target instanceof Element) || !ev.target.matches(TEXT_FIELD_SELECTOR)) {
      return;
    }
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._scrollActive(), RESIZE_SETTLE_MS);
  }

  private _scrollActive(): void {
    const el = this._document.activeElement;
    if (el && el.matches(TEXT_FIELD_SELECTOR)) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

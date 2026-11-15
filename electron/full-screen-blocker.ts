import { BrowserWindow, BrowserWindowConstructorOptions, ipcMain } from 'electron';
import { IPC } from './shared-with-frontend/ipc-events.const';
import { join } from 'path';
import { pathToFileURL } from 'node:url';
import { assertSecureWebPreferences } from './web-preferences-guard';

export interface FullScreenBlockerArgs {
  msg: string;
  /** Optional image shown on the overlay. */
  imgUrl?: string | null;
  /** How long the overlay stays up; defaults to 5 s. */
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 5000;

export const initFullScreenBlocker = (IS_DEV: boolean): void => {
  let isFullScreenWindowOpen = false;
  ipcMain.on(
    IPC.FULL_SCREEN_BLOCKER,
    (ipcEvent, { msg, imgUrl, durationMs }: FullScreenBlockerArgs): void => {
      if (isFullScreenWindowOpen) {
        return;
      }
      let isClosable = false;
      // This overlay loads a local file with no preload bridge, so it was
      // relying on Electron's secure defaults. Set the boundary explicitly and
      // assert it, so a future Electron default change can't silently open it.
      const webPreferences: BrowserWindowConstructorOptions['webPreferences'] = {
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        // Also disabled session-wide in start-app; this is the layer that holds
        // if that call is skipped or this window ever gets its own session.
        spellcheck: false,
      };
      assertSecureWebPreferences(webPreferences, 'full-screen-blocker');
      const win = new BrowserWindow({
        title: msg,
        fullscreen: true,
        alwaysOnTop: true,
        transparent: true,
        skipTaskbar: true,
        frame: false,
        webPreferences,
      });
      const duration = durationMs || DEFAULT_DURATION_MS;

      win.setAlwaysOnTop(true, 'floating');
      win.setVisibleOnAllWorkspaces(true);
      win.setFullScreenable(false);
      isFullScreenWindowOpen = true;
      const overlayUrl = pathToFileURL(
        join(
          __dirname,
          IS_DEV
            ? '../src/static/full-screen-overlay.html'
            : '../.tmp/angular-dist/browser/static/full-screen-overlay.html',
        ),
      ).href;
      win.loadURL(
        overlayUrl +
          `#msg=${encodeURIComponent(msg)}&img=${encodeURIComponent(imgUrl ?? '')}&time=${duration}`,
      );
      const closeTimeout = setTimeout(() => {
        isClosable = true;
        win.close();
      }, duration);

      win.on('close', (evI) => {
        if (isClosable) {
          if (closeTimeout) {
            clearTimeout(closeTimeout);
          }
          isFullScreenWindowOpen = false;
        } else {
          evI.preventDefault();
        }
      });

      win.on('closed', () => {
        // Clean up references
        isFullScreenWindowOpen = false;
        if (closeTimeout) {
          clearTimeout(closeTimeout);
        }
      });
    },
  );
};

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('ts-node/register/transpile-only');

const { toPayloadOnlyIpcListener } = require(
  path.resolve(__dirname, 'shared-with-frontend/preload-api.ts'),
);

test('renderer listeners receive payloads without the Electron event object', () => {
  const received = [];
  const listener = toPayloadOnlyIpcListener((...args) => received.push(args));
  const rawEvent = {
    sender: {
      invoke: () => {
        throw new Error('must not be exposed');
      },
    },
  };

  listener(rawEvent, { safe: true }, 'payload');

  assert.deepEqual(received, [[{ safe: true }, 'payload']]);
  assert.notEqual(received[0][0], rawEvent);
});

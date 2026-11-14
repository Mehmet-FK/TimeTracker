type PayloadListener = (...args: unknown[]) => void;

export const toPayloadOnlyIpcListener =
  (listener: PayloadListener) =>
  (_event: unknown, ...args: unknown[]): void =>
    listener(...args);

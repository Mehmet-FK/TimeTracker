import { Module } from './module.model';

export const isValidIconUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Returns a list of error keys; empty when the module is valid. */
export const validateModule = (
  module: Pick<Module, 'name' | 'description' | 'iconUrl'>,
): string[] => {
  const errors: string[] = [];
  if (typeof module.name !== 'string' || !module.name.trim()) {
    errors.push('NAME_REQUIRED');
  }
  if (module.iconUrl && !isValidIconUrl(module.iconUrl)) {
    errors.push('ICON_URL_INVALID');
  }
  return errors;
};

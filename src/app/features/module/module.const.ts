import { Module } from './module.model';

/**
 * The fixed GENERAL module. Every task belongs to at least one module; tasks
 * left without one are linked to GENERAL. It cannot be edited or deleted.
 */
export const GENERAL_MODULE_ID = 'GENERAL';

export const GENERAL_MODULE: Module = {
  id: GENERAL_MODULE_ID,
  name: 'General',
};

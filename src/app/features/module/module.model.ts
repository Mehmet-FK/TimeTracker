import { EntityState } from '@ngrx/entity';

export interface Module {
  id: string;
  /** Required, non-empty. */
  name: string;
  description?: string;
  /** Optional, must be an http(s) URL when set. */
  iconUrl?: string;
}

export type ModuleState = EntityState<Module>;

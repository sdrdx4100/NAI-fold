import { mockProvider } from './mock';
import { novelaiProvider } from './novelai';
import type { ApiConfig, Provider } from './types';

export * from './types';

export const providerFor = (cfg: ApiConfig): Provider => (cfg.mock || !cfg.token.trim() ? mockProvider : novelaiProvider);
export const isMock = (cfg: ApiConfig) => cfg.mock || !cfg.token.trim();

import type { ImageGenSettings, Subscription } from '../types';

export interface ApiConfig {
  token: string;
  mock: boolean;
  apiBase: string;
  imageBase: string;
}

export interface ImageRequest {
  settings: ImageGenSettings;
  seed: number;
  baseImage?: Blob | null;
  signal?: AbortSignal;
  onProgress?: (p: number) => void;
}

export interface ImageResult {
  images: Blob[];
  seed: number;
}

export interface Provider {
  generateImages(cfg: ApiConfig, req: ImageRequest): Promise<ImageResult>;
  getSubscription(cfg: ApiConfig): Promise<Subscription>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

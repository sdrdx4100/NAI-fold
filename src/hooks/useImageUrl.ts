import { useEffect, useState } from 'react';
import { useImages } from '../store/images';

export function useImageUrl(id: string | null | undefined): string | null {
  const cached = useImages((s) => (id ? s.urls[id] : undefined));
  const [url, setUrl] = useState<string | null>(cached ?? null);
  useEffect(() => {
    if (!id) return setUrl(null);
    if (cached) return setUrl(cached);
    let alive = true;
    void useImages
      .getState()
      .url(id)
      .then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id, cached]);
  return url;
}

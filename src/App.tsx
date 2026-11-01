import { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { requestPersistence } from './lib/db';
import { isMock } from './lib/api';
import { useImages } from './store/images';
import { useSettings } from './store/settings';
import { flushStories, useStories } from './store/stories';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await useSettings.getState().load();
      await Promise.all([useStories.getState().loadAll(), useImages.getState().load()]);
      setReady(true);
      void requestPersistence();
      const st = useSettings.getState();
      if (!isMock(st.api)) void st.refreshSubscription().catch(() => undefined);
    })();
    const onHide = () => document.visibilityState === 'hidden' && flushStories();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushStories);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushStories);
    };
  }, []);

  if (!ready)
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div className="spinner" />
        <div style={{ fontFamily: 'var(--font-head)', color: 'var(--accent)' }}>NAI Fold</div>
      </div>
    );
  return <Shell />;
}

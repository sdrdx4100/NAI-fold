import { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { isMock } from './lib/api';
import { requestPersistence } from './lib/db';
import { useImages } from './store/images';
import { useSettings } from './store/settings';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await useSettings.getState().load();
      await useImages.getState().load();
      setReady(true);
      void requestPersistence();
      const st = useSettings.getState();
      if (!isMock(st.api)) void st.refreshSubscription().catch(() => undefined);
    })();
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

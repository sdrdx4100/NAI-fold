import { Capacitor, registerPlugin } from '@capacitor/core';
import { blobToBase64 } from './util';

/** Features that only exist in the Android app build. All functions are safe no-ops in the browser. */
export const isNative = () => Capacitor.isNativePlatform();

interface GallerySaverPlugin {
  saveImage(opts: { base64: string; filename: string; album?: string; mimeType?: string }): Promise<{ uri: string }>;
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver');

export const GALLERY_ALBUM = 'NAI Fold';

/** Save straight into the phone's photo library (Pictures/NAI Fold). */
export async function saveToGallery(blob: Blob, filename: string): Promise<string> {
  const base64 = await blobToBase64(blob);
  const res = await GallerySaver.saveImage({ base64, filename, album: GALLERY_ALBUM, mimeType: blob.type || 'image/png' });
  return res.uri;
}

let notifId = 1;

async function notifications() {
  return (await import('@capacitor/local-notifications')).LocalNotifications;
}

/** Ask for notification permission once (Android 13+ shows a system dialog). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const ln = await notifications();
    let p = await ln.checkPermissions();
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await ln.requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

/** Show a notification, but only when the app is in the background (no point otherwise). */
export async function notifyIfBackground(title: string, body: string): Promise<void> {
  if (!isNative() || document.visibilityState !== 'hidden') return;
  try {
    const ln = await notifications();
    await ln.schedule({
      notifications: [{ id: notifId++, title, body, smallIcon: 'ic_stat_nai', iconColor: '#f5f3c2', autoCancel: true }],
    });
  } catch {
    /* permission denied or plugin unavailable */
  }
}

import { useEffect, useState } from 'react';
import { pushConfigured, registerPush, unregisterPush } from './push';

export { pushConfigured };

/*
 * Install handling.
 * Chrome fires `beforeinstallprompt` once, right after page load — usually long before
 * the user opens the Profile tab. So we capture it here at startup (this module is
 * imported from main.jsx) and keep it until the user taps "Install".
 */

let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  emit();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  emit();
});

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return outcome; // 'accepted' | 'dismissed'
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', fn);
    return () => {
      listeners.delete(fn);
      mq.removeEventListener?.('change', fn);
    };
  }, []);
  return { canPrompt: !!deferredPrompt, installed: isStandalone(), ios: isIOS() };
}

/* ---------------- notifications ---------------- */

const PREF_KEY = 'notify-enabled';

export const notifySupported = () => 'Notification' in window && 'serviceWorker' in navigator;

export function notifyEnabled() {
  if (!notifySupported() || Notification.permission !== 'granted') return false;
  try {
    return localStorage.getItem(PREF_KEY) !== '0';
  } catch {
    return true;
  }
}

export async function enableNotifications(uid) {
  if (!notifySupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  try {
    localStorage.setItem(PREF_KEY, perm === 'granted' ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (perm === 'granted' && uid) await registerPush(uid);
  return perm; // 'granted' | 'denied' | 'default'
}

export function disableNotifications() {
  try {
    localStorage.setItem(PREF_KEY, '0');
  } catch {
    /* ignore */
  }
  return unregisterPush();
}

export async function showMessageNotification({ title, body, chatId, icon }) {
  if (!notifyEnabled()) return;
  const options = {
    body,
    icon: icon || '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: `chat-${chatId}`, // one notification per chat, replaced by newer messages
    renotify: true,
    data: { url: `/chat/${chatId}` },
  };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(title, options);
    // eslint-disable-next-line no-new
    new Notification(title, options);
  } catch {
    /* ignore */
  }
}

export function setAppBadge(count) {
  try {
    if (count > 0) navigator.setAppBadge?.(count);
    else navigator.clearAppBadge?.();
  } catch {
    /* ignore */
  }
}

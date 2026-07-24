/**
 * Tiny self-contained "new message" alert that uses the Web Audio API
 * (no asset file needed) and the browser Notification API for desktop popups.
 */
let _audioCtx = null;
const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (_audioCtx) return _audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  _audioCtx = new Ctor();
  return _audioCtx;
};

export const playMessagePing = () => {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    // Two-tone ping: G5 → C6
    const tones = [
      { freq: 783.99, start: 0, dur: 0.12 },
      { freq: 1046.5, start: 0.1, dur: 0.18 },
    ];
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch (err) {
    console.warn('playMessagePing failed', err);
  }
};

export const requestDesktopNotificationPermission = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
};

export const showDesktopNotification = (title, body, onClick) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/brand-logo.png',
      tag: 'myisraelrental-message',
    });
    if (onClick) {
      n.onclick = () => {
        try { window.focus(); } catch { /* noop */ }
        onClick();
        n.close();
      };
    }
  } catch (err) {
    console.warn('showDesktopNotification failed', err);
  }
};

// Sesli okuma: tarayıcının yerleşik speechSynthesis'i (çevrimdışı çalışır, kota / ağ yok).
import { S } from './veri.js';

let sesler = [];
export const sesVar = () => 'speechSynthesis' in globalThis && typeof SpeechSynthesisUtterance !== 'undefined' && sesler.length > 0;

function yukle() {
  try { sesler = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang)); } catch { sesler = []; }
  document.documentElement.classList.toggle('sessiz', !sesVar());
}
if ('speechSynthesis' in globalThis) {
  yukle();
  try { speechSynthesis.addEventListener('voiceschanged', yukle); } catch { speechSynthesis.onvoiceschanged = yukle; }
} else {
  queueMicrotask(() => document.documentElement.classList.add('sessiz'));
}

function sesSec(aksan) {
  const hedef = aksan.toLowerCase().replace('_', '-');
  const uygun = sesler.filter(v => v.lang.toLowerCase().replace('_', '-') === hedef);
  const liste = uygun.length ? uygun : sesler;
  return liste.find(v => /natural|neural|premium|enhanced|samantha|daniel|google/i.test(v.name)) || liste.find(v => v.localService) || liste[0];
}

/** İngilizce metni oku. */
export function oku(metin, { aksan = S.ayar.aksan, hiz = S.ayar.hiz } = {}) {
  if (!sesVar() || !metin) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(metin);
    const v = sesSec(aksan || 'en-US');
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = aksan || 'en-US';
    u.rate = Math.min(1.6, Math.max(0.5, Number(hiz) || 1));
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}
export function aksanlar() {
  const v = new Set(sesler.map(s => s.lang.replace('_', '-')));
  return { us: [...v].some(l => /en-us/i.test(l)), gb: [...v].some(l => /en-gb/i.test(l)) };
}

// Read-aloud via the browser's built-in speech synthesis (works offline on most devices).
import { getState } from '../state/store.js';
import { plainText, stripEmoji } from './dom.js';
import { speakable } from './kid/words.js';

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Background music listens for this to duck itself while the voice is talking.
const announceSpeaking = (speaking) => {
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('sol:speech', { detail: { speaking } }));
};

export function stopSpeaking() {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  announceSpeaking(false);
}

// force=true speaks even when the read-aloud setting is off (explicit "Read aloud" buttons).
export function speak(text, force = false) {
  if (!canSpeak() || !text) return;
  if (!force && !getState().settings.readAloud) return;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(speakable(stripEmoji(plainText(text))));
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.lang = 'en-US';
  utterance.onstart = () => announceSpeaking(true);
  utterance.onend = () => announceSpeaking(false);
  utterance.onerror = () => announceSpeaking(false);
  window.speechSynthesis.speak(utterance);
}

// Read-aloud via the browser's built-in speech synthesis (works offline on most devices).
import { getState } from '../state/store.js';
import { plainText, stripEmoji } from './dom.js';
import { speakable } from './kid/words.js';

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
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
  window.speechSynthesis.speak(utterance);
}

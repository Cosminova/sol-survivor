// Settings: sound, read-aloud, motion, text size, contrast, commander name, and teacher tools.
import '../../styles/settings.css';
import { h, mount, announce } from '../dom.js';
import { getState, subscribe, setSettings, setProfile, resetAll } from '../../state/store.js';
import { play } from '../audio.js';
import { speak, canSpeak } from '../speech.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/common.js';

const TEXT_SIZES = [
  { id: 'normal', label: 'A', name: 'Normal' },
  { id: 'large', label: 'A+', name: 'Large' },
  { id: 'xl', label: 'A++', name: 'Extra large' },
];

const sanitizeName = (v) => v.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 24);

function toggle(id, label, hint, checked, onChange) {
  return h('label', { class: 'switch set-switch', for: id },
    h('span', { class: 'set-label' }, h('strong', null, label), h('span', { class: 'faint' }, hint)),
    h('input', { id, type: 'checkbox', checked, onchange: (e) => onChange(e.currentTarget.checked) }));
}

function confirmReset() {
  openModal({
    title: '⚠️ Reset all progress?',
    content: (close) => h('div', { class: 'stack' },
      h('p', null, 'This erases campaign stars, badges, quiz scores, the saved mission and your mission patch on this device. Settings are reset too.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-danger', onclick: () => { resetAll(); close(); toast('Progress reset. Fresh start, Cadet!', { icon: '🧹' }); } }, 'Yes, erase everything'),
        h('button', { type: 'button', class: 'btn', 'data-autofocus': true, onclick: close }, 'Cancel'))),
  });
}

function view() {
  const { settings, profile } = getState();
  const nameInput = h('input', { id: 'set-name', class: 'input', maxlength: 24, value: profile?.name ?? '', placeholder: 'Your name', autocomplete: 'off' });
  const saveName = () => {
    const name = sanitizeName(nameInput.value.trim());
    setProfile({ ...profile, name });
    announce(name ? `Name saved: ${name}` : 'Name cleared');
  };

  return h('div', { class: 'set-screen' },
    h('header', { class: 'screen-head' },
      h('div', null,
        h('span', { class: 'kicker' }, '⚙️ Settings'),
        h('h1', null, 'Make Sol Survivor work for you'),
        h('p', null, 'Changes save automatically on this device.'))),
    h('div', { class: 'set-grid' },
      h('section', { class: 'panel', 'aria-labelledby': 'set-sound' },
        h('h2', { class: 'panel-title', id: 'set-sound' }, '🔊 Sound and voice'),
        toggle('set-sfx', 'Sound effects', 'Beeps for new sols, alerts and wins', settings.sound, (v) => { setSettings({ sound: v }); if (v) setTimeout(() => play('good'), 50); }),
        toggle('set-read', 'Read aloud', canSpeak() ? 'Reads events and briefings out loud' : 'Not supported in this browser', settings.readAloud, (v) => { setSettings({ readAloud: v }); if (v) speak('Read aloud is on, Commander.', true); }),
        h('div', { class: 'row set-tests' },
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => play('win') }, '▶ Test sound'),
          canSpeak() ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => speak('Houston, Sol Survivor is ready for launch.', true) }, '▶ Test voice') : null)),
      h('section', { class: 'panel', 'aria-labelledby': 'set-display' },
        h('h2', { class: 'panel-title', id: 'set-display' }, '🖥️ Display'),
        h('div', { class: 'set-row' },
          h('span', { class: 'set-label', id: 'set-text-label' }, h('strong', null, 'Text size'), h('span', { class: 'faint' }, 'Bigger text for projectors and tablets')),
          h('div', { class: 'row', role: 'group', 'aria-labelledby': 'set-text-label' }, TEXT_SIZES.map((t) => h('button', {
            type: 'button', class: 'chip set-size', 'aria-pressed': String(settings.textSize === t.id), 'aria-label': t.name, id: `set-size-${t.id}`,
            onclick: () => setSettings({ textSize: t.id }),
          }, t.label)))),
        toggle('set-contrast', 'High contrast', 'Brighter text and stronger outlines', settings.highContrast, (v) => setSettings({ highContrast: v })),
        toggle('set-motion', 'Reduce motion', 'Stops spinning planets, dust and animations', settings.reducedMotion, (v) => setSettings({ reducedMotion: v }))),
      h('section', { class: 'panel', 'aria-labelledby': 'set-you' },
        h('h2', { class: 'panel-title', id: 'set-you' }, '🧑‍🚀 Commander'),
        h('label', { class: 'field', for: 'set-name' }, h('span', null, 'Name on your certificate'), nameInput),
        h('div', { class: 'row set-tests' },
          h('button', { type: 'button', class: 'btn btn-sm btn-cyan', onclick: saveName }, 'Save name'),
          h('span', { class: 'faint' }, 'Use a first name or nickname only. Nothing leaves this device.'))),
      h('section', { class: 'panel', 'aria-labelledby': 'set-teach' },
        h('h2', { class: 'panel-title', id: 'set-teach' }, '🍎 For teachers'),
        toggle('set-unlock', 'Unlock all chapters', 'Jump to any chapter for a lesson or demo', settings.unlockAll, (v) => setSettings({ unlockAll: v })),
        h('div', { class: 'row set-tests' },
          h('a', { class: 'btn btn-sm', href: '#/educators' }, '📚 Educator guide'),
          h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: confirmReset }, '🧹 Reset all progress')))));
}

export function render(root) {
  const draw = () => {
    const focusId = document.activeElement?.id;
    mount(root, view());
    if (focusId) document.getElementById(focusId)?.focus();
  };
  draw();
  let last = getState().settings;
  return subscribe((st) => {
    if (st.settings !== last) { last = st.settings; draw(); }
  });
}

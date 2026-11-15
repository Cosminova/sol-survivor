// HUD overlay DOM (all inside the container). Pure presentation: index.js feeds it state.
import { TASKS } from '../engine/sim.js';
import { formatClock } from './gameLogic.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c.nodeType ? c : stripEmoji(String(c)));
  return node;
}

export const stripEmoji = (s) => s.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]+/gu, '').replace(/ {2,}/g, ' ');

const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

export function createHud(container, { onSelectCrew, onButton, onWhy, touch }) {
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  const solName = el('div', { class: 'w3d-sol' });
  const solTime = el('div', { class: 'w3d-time' });
  const sunDot = el('i', { 'aria-hidden': 'true' });
  const sunbar = el('div', { class: 'w3d-sunbar', role: 'progressbar', 'aria-label': 'Daylight left' }, el('b', { title: 'Dusk' }), sunDot);
  const tl = el('div', { class: 'w3d-panel w3d-tl w3d-hide-cine' }, solName, solTime, sunbar);

  const objList = el('ul');
  const obj = el('div', { class: 'w3d-panel w3d-obj w3d-hide-cine', 'aria-live': 'polite' }, el('h3', { text: 'Today’s objectives' }), objList);

  const map = el('canvas', { class: 'w3d-map w3d-panel', width: 300, height: 300, 'aria-label': 'Minimap' });
  const rankName = el('div', { style: 'font-weight:800' });
  const rankBar = el('span');
  const rankXp = el('div', { style: 'font-size:12px;opacity:.8' });
  const combo = el('div', { class: 'w3d-combo' });
  const tr = el('div', { class: 'w3d-tr w3d-hide-cine' }, map, el('div', { class: 'w3d-panel w3d-rank' }, rankName, el('div', { class: 'w3d-bar' }, rankBar), rankXp, combo));

  const roster = el('div', { class: 'w3d-roster w3d-hide-cine', role: 'group', 'aria-label': 'Crew: pick who you control' });

  const gauge = el('div', { class: 'w3d-gauge', role: 'meter', 'aria-label': 'Suit oxygen' }, el('div', { text: '100%' }));
  const suitDl = el('dl');
  const suit = el('div', { class: 'w3d-panel w3d-suit w3d-hide-cine' }, gauge, suitDl);

  const radio = el('div', { class: 'w3d-radio', role: 'status', 'aria-live': 'polite' });
  const caption = el('div', { class: 'w3d-caption', 'aria-live': 'polite' });
  const prompt = el('div', { class: 'w3d-panel w3d-prompt w3d-hide-cine' });
  const bottom = el('div', { class: 'w3d-bottom' }, radio, caption, prompt);

  const ringFg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 84 84');
  ring.setAttribute('class', 'w3d-ring');
  ring.innerHTML = '<circle cx="42" cy="42" r="36" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.25)" stroke-width="8"/>';
  ringFg.setAttribute('cx', '42'); ringFg.setAttribute('cy', '42'); ringFg.setAttribute('r', '36');
  ringFg.setAttribute('fill', 'none'); ringFg.setAttribute('stroke', '#7fe3ff'); ringFg.setAttribute('stroke-width', '8');
  ringFg.setAttribute('stroke-dasharray', String(2 * Math.PI * 36));
  ringFg.setAttribute('transform', 'rotate(-90 42 42)');
  ring.append(ringFg);

  const toasts = el('div', { class: 'w3d-toasts', 'aria-live': 'polite' });
  const alert = el('div', { class: 'w3d-alert', role: 'alert' });
  const vig = el('div', { class: 'w3d-vig' });
  const flashEl = el('div', { class: 'w3d-flash' });
  const floats = el('div', { style: 'position:absolute;inset:0;pointer-events:none' });
  const level = el('div', { class: 'w3d-level', 'aria-live': 'assertive' });
  const title = el('div', { class: 'w3d-title' });

  const muteBtn = el('button', { class: 'w3d-btn', 'aria-label': 'Toggle sound (M)', onclick: () => onButton('mute') }, '🔊');
  const btns = el('div', { class: 'w3d-btns w3d-hide-cine' },
    muteBtn,
    el('button', { class: 'w3d-btn', 'aria-label': 'Controls help (H)', onclick: () => onButton('help') }, '❓'),
    el('button', { class: 'w3d-btn', 'aria-label': 'Pause menu (P)', onclick: () => onButton('pause') }, '⏸'));

  const knob = el('i');
  const joy = el('div', { class: 'w3d-joy', 'aria-hidden': 'true' }, knob);
  const act = el('button', { class: 'w3d-act', 'aria-label': 'Interact' }, 'E');
  const touchLayer = el('div', { class: 'w3d-touch w3d-hide-cine' }, joy, act);

  const layer = el('div', { class: 'w3d-layer' });
  const skip = el('button', { class: 'w3d-skip', onclick: () => onButton('skipIntro') }, 'Skip intro ▶');
  const root = el('div', { class: 'w3d-root' },
    vig, flashEl, floats, tl, obj, tr, roster, suit, bottom, ring, toasts, alert, btns, touchLayer, title, level,
    el('div', { class: 'w3d-cut w3d-top' }), el('div', { class: 'w3d-cut w3d-bot' }), skip, layer);
  container.append(root);
  if (touch) container.dataset.touch = 'true';

  let rosterKey = '';
  function setRoster(crew, playerId) {
    const key = crew.map((c) => `${c.id}${c.task}${Math.round(c.health)}${Math.round(c.morale)}`).join('|') + playerId;
    if (key === rosterKey) return;
    rosterKey = key;
    roster.replaceChildren(...crew.map((c, i) => el('button', {
      class: 'w3d-chip', 'aria-pressed': String(c.id === playerId), title: `Control ${c.name} (${i + 1})`,
      onclick: () => onSelectCrew(c.id),
    },
    el('span', { class: 'w3d-av', 'aria-hidden': 'true' }, c.avatar ?? '🧑‍🚀'),
    el('span', null, el('b', null, `${i + 1}. ${c.name.split(' ')[0]}`), c.id === playerId ? ' (you)' : '',
      el('small', null, `${TASKS[c.task]?.label ?? c.task}`),
      el('span', { class: 'w3d-mini', 'aria-label': `Health ${Math.round(c.health)}, morale ${Math.round(c.morale)}` },
        el('span', null, el('i', { style: `width:${c.health}%;background:#3ddc84` })),
        el('span', null, el('i', { style: `width:${c.morale}%;background:#4da3ff` })))),
    el('span', { 'aria-hidden': 'true' }, TASKS[c.task]?.icon ?? ''))));
  }

  let objKey = '';
  function setObjectives(list) {
    const key = list.map((o) => `${o.id}${o.count}${o.done}`).join('|');
    if (key === objKey) return;
    objKey = key;
    objList.replaceChildren(...list.map((o) => el('li', { 'data-done': String(o.done), 'data-urgent': String(Boolean(o.urgent)) },
      el('span', { class: 'w3d-ck', 'aria-hidden': 'true' }, o.done ? '✓' : o.urgent ? '!' : '○'),
      el('span', null, o.label, o.target > 1 ? ` (${o.count}/${o.target})` : '', el('span', { class: 'w3d-sr' }, o.done ? ' done' : ' to do')))));
  }

  function setSol({ sol, site, hours, t, body }) {
    solName.textContent = `${body === 'moon' ? 'Day' : 'Sol'} ${sol} · ${site}`;
    solTime.textContent = `${formatClock(hours)} ${body === 'moon' ? 'shift time' : 'local solar time'}`;
    sunDot.style.left = pct(t);
    sunbar.setAttribute('aria-valuenow', String(Math.round((1 - Math.min(1, t)) * 100)));
  }

  function setRank({ rank, xp, progress, next, combo: c }) {
    rankName.textContent = `${rank.icon} ${rank.label}`;
    rankBar.style.width = pct(progress);
    rankXp.textContent = next ? `${xp} / ${next.xp} XP` : `${xp} XP · max rank`;
    combo.textContent = c >= 2 ? `🔥 Combo ×${c}` : '';
  }

  let lastSuit = '';
  function setSuit({ o2, dose, rate, outside, inRover, cold }) {
    const key = `${Math.round(o2 * 100)}|${dose.toFixed(2)}|${outside}|${inRover}|${rate > 0.2}`;
    if (key === lastSuit) return;
    lastSuit = key;
    const v = Math.round(o2 * 100);
    gauge.style.setProperty('--v', v);
    gauge.style.setProperty('--c', o2 < 0.25 ? '#ff5d5d' : o2 < 0.5 ? '#ffd23f' : '#3ddc84');
    gauge.firstChild.textContent = `${o2 < 0.25 ? '⚠' : ''}${v}%`;
    gauge.setAttribute('aria-valuenow', String(v));
    suitDl.replaceChildren(
      el('dt', null, 'Suit O₂'), el('dd', null, outside ? (o2 < 0.25 ? 'LOW!' : 'on EVA') : inRover ? 'refilling (rover)' : 'refilling'),
      el('dt', null, '☢ Dose'), el('dd', null, `${dose.toFixed(2)} mSv${rate > 0.2 ? ' ⚠' : ''}`),
      el('dt', null, 'Where'), el('dd', null, outside ? (cold ? 'Outside · −170 °C' : 'Outside') : inRover ? 'In rover' : 'Inside'));
  }

  let promptKey = '';
  function setPrompt(info) {
    const key = info ? `${info.text}|${info.alts?.map((a) => a.label).join(',')}|${info.why?.term}` : '';
    if (key === promptKey) return;
    promptKey = key;
    prompt.classList.toggle('w3d-on', Boolean(info));
    if (!info) { prompt.replaceChildren(); return; }
    prompt.replaceChildren(
      el('span', { class: 'w3d-key' }, touch ? 'E' : 'E'), el('span', { style: 'font-weight:700' }, info.text),
      ...(info.alts ?? []).map((a) => el('button', { class: 'w3d-alt', onclick: a.onClick }, a.label)),
      info.why ? el('button', { class: 'w3d-why', onclick: () => onWhy(info.why.term), title: 'Q' }, `ℹ️ Why this matters: ${info.why.text}`) : null);
  }

  function setHold(v) {
    ring.classList.toggle('w3d-on', v != null);
    if (v != null) ringFg.setAttribute('stroke-dashoffset', String(2 * Math.PI * 36 * (1 - v)));
  }

  function toast(text, tone = 'info') {
    const t = el('div', { class: 'w3d-toast', 'data-tone': tone }, text);
    toasts.append(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    later(() => t.remove(), 2800);
  }

  function setAlert(text, kind = 'danger') {
    alert.classList.toggle('w3d-on', Boolean(text));
    if (text) { alert.textContent = text; alert.dataset.kind = kind; }
  }

  function floatText(text, x, y, color = '#ffe066') {
    const f = el('div', { class: 'w3d-float', style: `left:${x}px;top:${y}px;color:${color}` }, text);
    floats.append(f);
    later(() => f.remove(), 1500);
  }

  function flash(strength = 0.6, color = '#fff') {
    flashEl.style.background = color;
    flashEl.style.transition = 'none';
    flashEl.style.opacity = String(strength);
    requestAnimationFrame(() => { flashEl.style.transition = 'opacity .9s'; flashEl.style.opacity = '0'; });
  }

  function levelUp(rank) {
    level.replaceChildren(el('div', null, el('b', null, rank.icon), el('div', { style: 'font-size:16px;letter-spacing:.3em' }, 'RANK UP!'), el('strong', null, rank.label)));
    level.classList.add('w3d-on');
    later(() => level.classList.remove('w3d-on'), 2700);
  }

  let captionTimer = null;
  function setCaption(text) {
    caption.textContent = text;
    if (captionTimer) clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { caption.textContent = ''; }, 2200);
  }

  return {
    root, layer, map, radio, joy, knob, act,
    setRoster, setObjectives, setSol, setRank, setSuit, setPrompt, setHold, toast, setAlert, floatText, flash, levelUp,
    setCaption,
    setVignette: (v) => { vig.style.opacity = String(v); },
    setMuted: (m) => { muteBtn.textContent = m ? '🔇' : '🔊'; },
    setCinematic: (on) => { container.dataset.cinematic = String(on); },
    setTitle: (text) => { title.textContent = text ?? ''; title.classList.toggle('w3d-on', Boolean(text)); },
    dispose() {
      for (const id of timers) clearTimeout(id);
      if (captionTimer) clearTimeout(captionTimer);
      root.remove();
    },
  };
}

// Mission Tools: live Mars clock, Earth–Mars distance, and kid-sized space calculators.
import '../../styles/tools.css';
import { h, mount } from '../dom.js';
import { marsClockCard } from './tools/marsClock.js';
import { orbitCard } from './tools/orbit.js';
import { solConverterCard, weightCard, ageCard } from './tools/calculators.js';

// Each builder returns a node or { node, cleanup }. One failing tool must not blank the screen.
function safe(build, name) {
  try {
    const result = build();
    return result instanceof Node ? { node: result, cleanup: null } : result;
  } catch (err) {
    console.error(`[tools] ${name} failed`, err);
    return { node: h('div', { class: 'panel empty' }, h('span', { class: 'big', 'aria-hidden': 'true' }, '🛠️'), `The ${name} is offline right now.`), cleanup: null };
  }
}

export function render(root) {
  const tools = [
    safe(marsClockCard, 'Mars clock'),
    safe(orbitCard, 'distance tool'),
    safe(solConverterCard, 'sol converter'),
    safe(weightCard, 'weight calculator'),
    safe(ageCard, 'age calculator'),
  ];

  mount(root,
    h('div', { class: 'tools-screen' },
      h('header', { class: 'screen-head tools-hero' },
        h('div', null,
          h('span', { class: 'kicker mars' }, '🧭 Mission Tools'),
          h('h1', null, 'Mission Control Toolkit'),
          h('p', null, 'Real calculators that mission planners use: what time it is on Mars, how long a radio message takes, and what you would weigh on another world.'))),
      h('div', { class: 'tools-grid' }, tools.map((t) => t.node))));

  return () => tools.forEach((t) => {
    try { t.cleanup?.(); } catch (err) { console.warn('[tools] cleanup failed', err); }
  });
}

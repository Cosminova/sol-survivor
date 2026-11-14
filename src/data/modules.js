// Equipment the player can pack into the lander. Mass is the main trade-off.
// kw = continuous electrical draw while switched on; output is per sol/day.
export const MODULES = [
  {
    id: 'solar', name: 'Solar Array (100 m²)', icon: '🔆', category: 'power',
    massKg: 300, kw: 0, areaM2: 100, max: 8,
    blurb: 'Cheap and light, but makes nothing at night and fades when dust covers it.',
    term: 'solar-array', source: 'mer-dust',
  },
  {
    id: 'fission', name: 'Fission Power Unit (10 kW)', icon: '⚛️', category: 'power',
    massKg: 1800, kw: 0, outputKw: 10, max: 3,
    blurb: 'Steady power day and night, through any dust storm. Heavy.',
    term: 'fission-surface-power', source: 'kilopower',
  },
  {
    id: 'battery', name: 'Battery Bank (100 kWh)', icon: '🔋', category: 'power',
    massKg: 700, kw: 0, storageKwh: 100, max: 6,
    blurb: 'Stores extra energy for nights and storms.',
    term: 'battery', source: 'kilopower',
  },
  {
    id: 'recycler', name: 'Water Recycler', icon: '♻️', category: 'life',
    massKg: 500, kw: 1, recovery: 0.98, max: 1, priority: 1,
    blurb: 'Recovers 98% of used water, like the ISS life support system.',
    term: 'eclss', source: 'eclss',
  },
  {
    id: 'oxygen', name: 'Oxygen Generator', icon: '🫧', category: 'life',
    massKg: 400, kw: 1.5, o2Kg: 3.6, max: 2, priority: 1,
    blurb: 'Splits water into oxygen with electricity (electrolysis). Uses 4 kg of water per sol.',
    term: 'electrolysis', source: 'eclss',
  },
  {
    id: 'moxie', name: 'MOXIE-XL Oxygen Plant', icon: '🌬️', category: 'isru', body: 'mars',
    massKg: 350, kw: 1.5, o2Kg: 1.5, max: 3, priority: 3,
    blurb: 'Makes oxygen from the carbon dioxide air of Mars. A scaled-up Perseverance MOXIE.',
    term: 'moxie', source: 'moxie',
  },
  {
    id: 'regolithO2', name: 'Regolith Oxygen Plant', icon: '🪨', category: 'isru', body: 'moon',
    massKg: 600, kw: 3, o2Kg: 1.5, max: 2, priority: 3,
    blurb: 'Heats moon dust to pull out oxygen. Moon rock is about 40% oxygen by mass.',
    term: 'isru', source: 'artemis',
  },
  {
    id: 'iceDrill', name: 'Ice Mining Drill', icon: '🧊', category: 'isru',
    massKg: 600, kw: 1.5, waterKg: 10, max: 2, priority: 3,
    blurb: 'Digs up buried ice and melts it. Output depends on how much ice your site has.',
    term: 'isru', source: 'ice',
  },
  {
    id: 'greenhouse', name: 'Greenhouse (50 m²)', icon: '🌱', category: 'life',
    massKg: 1200, kw: 3, foodKg: 1.4, o2Kg: 0.4, growSols: 25, max: 3, priority: 4,
    blurb: 'Grows fresh food and a little oxygen. Plants need 25 sols before the first harvest.',
    term: 'hydroponics', source: 'veggie',
  },
  {
    id: 'shelter', name: 'Storm Shelter', icon: '🛡️', category: 'safety',
    massKg: 900, kw: 0, max: 1,
    blurb: 'A small, thick-walled room. Hiding here blocks 95% of a solar particle storm.',
    term: 'storm-shelter', source: 'rad-2014',
  },
  {
    id: 'rover', name: 'Pressurized Rover', icon: '🚙', category: 'science',
    massKg: 1500, kw: 0.5, max: 1, priority: 5,
    blurb: 'Lets explorers reach farther sites: +50% science on EVAs.',
    term: 'eva', source: 'mars-sites',
  },
  {
    id: 'relay', name: 'Comms Relay Antenna', icon: '📡', category: 'science',
    massKg: 200, kw: 0.2, max: 1, priority: 5,
    blurb: 'Better video calls home keep crew morale up.',
    term: 'light-delay', source: 'jpl-elements',
  },
  {
    id: 'spares', name: 'Spare Parts Kit', icon: '🧰', category: 'safety',
    massKg: 150, kw: 0, max: 10,
    blurb: 'One kit fixes one broken machine instantly.',
    term: 'redundancy', source: 'bvad',
  },
];

// Consumables are packed in 100 kg crates; tank/packaging overhead is included.
export const SUPPLIES = [
  { id: 'o2', name: 'Oxygen tanks', icon: '🫁', unitKg: 100, packMass: 1.6, term: 'life-support' },
  { id: 'water', name: 'Water', icon: '💧', unitKg: 100, packMass: 1.1, term: 'life-support' },
  { id: 'food', name: 'Packaged food', icon: '🥫', unitKg: 100, packMass: 1.2, term: 'life-support' },
];

export const moduleById = (id) => MODULES.find((m) => m.id === id) ?? null;

export const modulesForBody = (body) => MODULES.filter((m) => !m.body || m.body === body);

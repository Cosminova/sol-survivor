// Kid-friendly science content for the 3D outpost: station explainers, rock fact cards,
// collectibles and CAPCOM radio lines. Every claim here is mainstream NASA science.

export const STATION_INFO = {
  habitat: { name: 'Habitat', icon: '🏠', term: 'habitat', why: 'Your pressurized home. Inside, the air, warmth and walls keep you alive.' },
  berm: { name: 'Regolith Berm', icon: '⛏️', term: 'radiation-shielding', why: 'A thick pile of soil over the habitat soaks up radiation, like a lead apron at the dentist.' },
  solar: { name: 'Solar Array', icon: '🔆', term: 'solar-array', why: 'Dust blocks sunlight. Clean panels make more power for the heaters and life support.' },
  greenhouse: { name: 'Greenhouse', icon: '🌱', term: 'hydroponics', why: 'Plants grow food and make oxygen. Astronauts on the ISS have eaten lettuce grown in space!' },
  shelter: { name: 'Storm Shelter', icon: '🛡️', term: 'storm-shelter', why: 'A thick-walled room that blocks about 95% of a solar particle storm.' },
  battery: { name: 'Battery Bank', icon: '🔋', term: 'battery', why: 'Stores daytime energy so the heaters keep running all night.' },
  recycler: { name: 'Water Recycler', icon: '♻️', term: 'eclss', why: 'Cleans used water so it can be drunk again, like the ISS recycles 98% of its water.' },
  oxygen: { name: 'Oxygen Generator', icon: '🫧', term: 'electrolysis', why: 'Uses electricity to split water into oxygen to breathe and hydrogen.' },
  moxie: { name: 'MOXIE Oxygen Plant', icon: '🌬️', term: 'moxie', why: 'Pulls oxygen out of the carbon dioxide air of Mars. Perseverance’s MOXIE proved it works.' },
  regolithO2: { name: 'Regolith Oxygen Plant', icon: '🪨', term: 'isru', why: 'Moon rock is about 40% oxygen. Heating it releases oxygen we can breathe.' },
  iceDrill: { name: 'Ice Drill', icon: '🧊', term: 'water-ice', why: 'Buried ice is melted into water for drinking, plants and making oxygen.' },
  fission: { name: 'Fission Reactor', icon: '⚛️', term: 'fission-surface-power', why: 'Steady power day and night, even in dust storms. Stay outside the keep-out ring!' },
  rover: { name: 'Pressurized Rover', icon: '🚙', term: 'eva', why: 'A shirt-sleeve car that lets explorers travel farther and refill their suits.' },
  relay: { name: 'Comms Relay', icon: '📡', term: 'light-delay', why: 'Radio messages take minutes to reach Earth. Good comms keep the crew happy.' },
  spares: { name: 'Spare Parts', icon: '🧰', term: 'redundancy', why: 'No hardware store on Mars! Each kit fixes one broken machine.' },
  outcrop: { name: 'Science Outcrop', icon: '🔭', term: 'eva', why: 'Rocks are history books. Scanning them tells us about water and life long ago.' },
};

export const ROCK_FACTS = {
  mars: [
    { id: 'blueberries', title: 'Hematite “blueberries”', icon: '🫐', text: 'Opportunity found tiny round hematite balls that formed in groundwater long ago. Water once soaked these rocks!' },
    { id: 'perchlorate', title: 'Perchlorate salt', icon: '🧂', text: 'Phoenix found perchlorate in Martian soil. It is toxic to people, so greenhouse soil must be washed first.' },
    { id: 'mars-ice', title: 'Buried ice', icon: '🧊', text: 'Orbiters spotted bright ice just under the dust at mid-latitudes. Future crews could mine it for water.' },
    { id: 'basalt', title: 'Basalt', icon: '🌋', text: 'Dark basalt is cooled lava. Mars has the biggest volcano in the Solar System, Olympus Mons.' },
    { id: 'delta-mud', title: 'Delta mudstone', icon: '🏞️', text: 'Jezero’s mudstone was laid down in an ancient lake. Perseverance seals samples like this in tubes for Earth.' },
    { id: 'gypsum', title: 'Gypsum veins', icon: '🤍', text: 'Curiosity found white gypsum veins where water once flowed through cracks in the rock.' },
  ],
  moon: [
    { id: 'anorthosite', title: 'Anorthosite', icon: '🤍', text: 'The bright lunar highlands are anorthosite, which floated to the top of an ancient ocean of magma.' },
    { id: 'moon-basalt', title: 'Mare basalt', icon: '🌑', text: 'The dark “seas” on the Moon are old lava flows. Apollo 11 brought back pieces of them.' },
    { id: 'moon-ice', title: 'Shadowed ice', icon: '🧊', text: 'Craters near the poles that never see sunlight hold water ice, colder than −200 °C.' },
    { id: 'glass-beads', title: 'Orange glass beads', icon: '🟠', text: 'Apollo 17 astronaut Jack Schmitt found orange soil made of tiny glass beads from ancient volcanic fountains.' },
    { id: 'breccia', title: 'Impact breccia', icon: '💥', text: 'Rocks smashed together by meteorite impacts. The Moon has no air to slow meteorites down.' },
  ],
};

export const COLLECTIBLES = [
  { id: 'meteorite-iron', body: 'any', kind: 'meteorite', name: 'Iron meteorite', icon: '☄️', fact: 'Opportunity found an iron meteorite the size of a basketball on Mars, nicknamed “Heat Shield Rock”.' },
  { id: 'meteorite-stony', body: 'any', kind: 'meteorite', name: 'Stony meteorite', icon: '🪨', fact: 'Some meteorites found on Earth actually came from Mars, blasted off by giant impacts.' },
  { id: 'patch-apollo11', body: 'moon', kind: 'patch', name: 'Apollo 11 patch', icon: '🦅', fact: 'Apollo 11 landed in the Sea of Tranquility on 20 July 1969. The eagle patch has no crew names on purpose.' },
  { id: 'patch-artemis', body: 'moon', kind: 'patch', name: 'Artemis II patch', icon: '🌙', fact: 'Artemis II carried four astronauts around the Moon in April 2026, the first crewed lunar flight since 1972.' },
  { id: 'part-lrv', body: 'moon', kind: 'part', name: 'Lunar rover wheel', icon: '🛞', fact: 'Apollo’s Lunar Roving Vehicle had wire-mesh wheels because rubber tyres would crack in the cold.' },
  { id: 'part-ssm', body: 'moon', kind: 'part', name: 'Seismometer piece', icon: '📈', fact: 'Apollo seismometers felt “moonquakes”. The Moon rang like a bell after impacts.' },
  { id: 'patch-perseverance', body: 'mars', kind: 'patch', name: 'Perseverance patch', icon: '🔴', fact: 'Perseverance landed in Jezero Crater in 2021 and carried Ingenuity, the first helicopter on another world.' },
  { id: 'part-oppy', body: 'mars', kind: 'part', name: 'Opportunity panel chip', icon: '🛰️', fact: 'Opportunity was built for 90 sols and lasted almost 15 years, until a 2018 dust storm covered its panels.' },
  { id: 'part-spirit', body: 'mars', kind: 'part', name: 'Spirit wheel tread', icon: '⚙️', fact: 'Spirit drove with a broken wheel and the dragging wheel dug up nearly pure silica, a clue to hot springs.' },
  { id: 'part-ingenuity', body: 'mars', kind: 'part', name: 'Ingenuity rotor tip', icon: '🚁', fact: 'Ingenuity flew 72 times on Mars, where the air is about 1% as thick as Earth’s.' },
];

export const CAPCOM = {
  welcome: (name) => `CAPCOM: Good morning, ${name}. Systems are green. Check your objectives and suit up.`,
  dusk: 'CAPCOM: Sun’s getting low. Head back to the habitat before dark.',
  nightfall: 'CAPCOM: Nightfall. Everyone inside, great work today.',
  o2Low: 'CAPCOM: Your suit oxygen is low! Get to the airlock or the rover to refill.',
  o2Out: 'CAPCOM: Oxygen empty! Emergency return. Always watch your suit gauge on EVA.',
  stormWarn: (s) => `CAPCOM: Solar particle storm inbound! Get to the shelter or habitat in ${s} seconds!`,
  stormSafe: 'CAPCOM: Nice work, you made it to cover before the protons hit.',
  stormHit: 'CAPCOM: Storm’s here. Particles are hitting the outpost. Get inside now!',
  devil: 'CAPCOM: Dust devil spotted! Those whirlwinds can push you around.',
  devilClean: 'CAPCOM: Lucky! That dust devil blew dust off the panels, just like it did for Spirit.',
  devilDust: 'CAPCOM: The dust devil coated the panels. Time for some cleaning.',
  meteor: (name) => `CAPCOM: Micrometeoroid strike on the ${name}! Repair it before it fails for good.`,
  meteorFixed: 'CAPCOM: Repair confirmed. Tiny space rocks hit hard: no air to slow them down.',
  dustStorm: 'CAPCOM: Dust storm on the horizon! The sky will go dark and panels will get dusty.',
  cold: 'CAPCOM: Lunar night: about −170 °C out there. Suit heaters drain your power faster.',
  levelUp: (rank) => `CAPCOM: Congratulations, you are now a ${rank}! Mission Control is proud.`,
  sample: 'CAPCOM: Sample logged. The science team is cheering back on Earth.',
  allAssigned: 'CAPCOM: Whole crew has their jobs. Head to the airlock when you are ready to end the sol.',
};

export const ROLE_COLORS = {
  commander: '#2f80ed',
  engineer: '#f2994a',
  botanist: '#27ae60',
  geologist: '#9b51e0',
};

// The Astronaut Dictionary. Definitions are written for readers aged about 9–14.
// category groups terms in the dictionary; related ids must exist (checked by tests).
export const CATEGORIES = {
  time: { label: 'Time & Seasons', icon: '🕰️' },
  planet: { label: 'Planets & Moons', icon: '🪐' },
  weather: { label: 'Weather & Dust', icon: '🌪️' },
  radiation: { label: 'Radiation & Space Weather', icon: '☢️' },
  life: { label: 'Life Support', icon: '🫁' },
  power: { label: 'Power & Energy', icon: '⚡' },
  isru: { label: 'Living off the Land', icon: '⛏️' },
  mission: { label: 'Missions & Operations', icon: '🚀' },
  body: { label: 'Human Body in Space', icon: '🧑‍🚀' },
  science: { label: 'Science Tools', icon: '🔬' },
};

export const GLOSSARY = [
  // Time & seasons
  { id: 'sol', term: 'Sol', category: 'time', def: 'One day on Mars: 24 hours, 39 minutes and 35 seconds. Mars rovers count their mission in sols, starting with Sol 0 on landing day.', example: 'Curiosity passed Sol 4,995 on 25 August 2026.', related: ['mars-year', 'lmst', 'msd'] },
  { id: 'mars-year', term: 'Mars Year', category: 'time', def: 'The time Mars takes to orbit the Sun once: 668.6 sols, or 687 Earth days. That is almost two Earth years. Scientists number them, starting with Mars Year 1 in 1955.', example: 'November 2026 falls in Mars Year 39.', related: ['sol', 'solar-longitude'] },
  { id: 'solar-longitude', term: 'Solar Longitude (Ls)', category: 'time', def: 'An angle from 0° to 360° that tells you the season on Mars. Ls 0° is the start of northern spring, 90° northern summer, 180° autumn and 270° winter.', example: 'Dust storm season is roughly Ls 180°–330°.', related: ['mars-year', 'dust-storm', 'perihelion'] },
  { id: 'lmst', term: 'Local Mean Solar Time (LMST)', category: 'time', def: 'The clock time at a particular spot on Mars, based on where the Sun is in the sky. Rover teams on Earth work on “Mars time” and shift their schedules about 40 minutes later every day.', related: ['sol', 'mtc'] },
  { id: 'mtc', term: 'Coordinated Mars Time (MTC)', category: 'time', def: 'The Mars version of Greenwich time: the local time at Mars’s prime meridian, in Airy-0 crater.', related: ['lmst', 'msd'] },
  { id: 'msd', term: 'Mars Sol Date (MSD)', category: 'time', def: 'A running count of sols since 29 December 1873. It lets scientists number every Martian day without confusion.', related: ['sol', 'mtc'] },
  { id: 'perihelion', term: 'Perihelion & Aphelion', category: 'time', def: 'Perihelion is when a planet is closest to the Sun; aphelion is farthest. Mars’s orbit is quite oval, so it gets about 45% more sunlight at perihelion.', example: 'Mars reaches perihelion near Ls 251°, right in dust storm season.', related: ['solar-longitude', 'orbit'] },
  { id: 'lunar-day', term: 'Lunar Day', category: 'time', def: 'From one sunrise to the next on the Moon takes about 29.5 Earth days, so most places get two weeks of sunlight followed by two weeks of darkness.', related: ['lunar-night', 'tidal-locking'] },
  { id: 'lunar-night', term: 'Lunar Night', category: 'time', def: 'The two weeks of darkness at most places on the Moon. Temperatures drop below −130 °C and solar panels make no power.', related: ['lunar-day', 'battery', 'fission-surface-power'] },
  { id: 'solar-conjunction', term: 'Solar Conjunction', category: 'time', def: 'When the Sun passes between Earth and Mars. For about two weeks, the Sun’s hot gas scrambles radio signals, so NASA stops sending commands to Mars.', example: 'Mars conjunctions happen about every 26 months.', related: ['light-delay', 'dsn'] },

  // Planets & moons
  { id: 'orbit', term: 'Orbit', category: 'planet', def: 'The curved path an object takes around another object because of gravity, like Mars around the Sun or Phobos around Mars.', related: ['perihelion', 'gravity'] },
  { id: 'gravity', term: 'Gravity', category: 'planet', def: 'The pull every object with mass has on every other. Mars’s gravity is 38% of Earth’s; the Moon’s is 17%.', example: 'A 40 kg kid would weigh like 15 kg on Mars and 7 kg on the Moon.', related: ['low-gravity', 'orbit'] },
  { id: 'regolith', term: 'Regolith', category: 'planet', def: 'The loose layer of dust, soil and broken rock covering a planet or moon. Piling it over a habitat makes great radiation shielding.', related: ['perchlorate', 'radiation-shielding', 'lunar-dust'] },
  { id: 'lunar-dust', term: 'Lunar Dust', category: 'planet', def: 'Moon dust is sharp like tiny glass shards, because no wind or water has ever smoothed it. It sticks to everything and wears out seals and suits.', example: 'Apollo astronauts said it smelled like spent gunpowder.', related: ['regolith'] },
  { id: 'phobos', term: 'Phobos & Deimos', category: 'planet', def: 'The two small, lumpy moons of Mars. Phobos zooms around Mars three times a day and is slowly spiraling inward.', related: ['eclipse', 'orbit'] },
  { id: 'tidal-locking', term: 'Tidal Locking', category: 'planet', def: 'When a moon spins exactly once per orbit, so it always shows the same face to its planet. Our Moon is tidally locked to Earth.', related: ['lunar-day'] },
  { id: 'lava-tube', term: 'Lava Tube', category: 'planet', def: 'A tunnel left behind when flowing lava drained away. Lava tubes on the Moon and Mars could protect future bases from radiation and meteoroids.', related: ['radiation-shielding'] },
  { id: 'crater', term: 'Crater', category: 'planet', def: 'A bowl-shaped hole made when an asteroid or comet hits a surface. Craters like Gale and Jezero once held lakes on Mars.', related: ['psr'] },
  { id: 'psr', term: 'Permanently Shadowed Region', category: 'planet', def: 'Crater floors near the Moon’s poles where sunlight never reaches. They are colder than −230 °C and trap water ice.', related: ['water-ice', 'crater'] },
  { id: 'magnetosphere', term: 'Magnetosphere', category: 'planet', def: 'An invisible magnetic bubble around a planet that deflects charged particles from the Sun. Earth has a strong one; Mars and the Moon do not.', related: ['galactic-cosmic-rays', 'aurora', 'solar-wind'] },
  { id: 'eclipse', term: 'Eclipse', category: 'planet', def: 'When one object blocks the light from another. On Mars, Phobos makes quick partial solar eclipses.', related: ['phobos'] },

  // Weather & dust
  { id: 'dust-storm', term: 'Dust Storm', category: 'weather', def: 'Winds lifting huge amounts of dust into the Martian sky. Regional storms happen every year; planet-encircling storms happen every few Mars years.', example: 'The 2018 global storm ended Opportunity’s mission.', related: ['tau', 'dust-devil', 'solar-array'] },
  { id: 'tau', term: 'Tau (Optical Depth)', category: 'weather', def: 'A number scientists use for how dusty the sky is. Tau 0.5 is a clear Martian day. Tau 3 is a big storm. Tau 10 is almost as dark as night.', related: ['dust-storm', 'solar-array'] },
  { id: 'dust-devil', term: 'Dust Devil', category: 'weather', def: 'A spinning column of rising air that picks up dust. Martian dust devils can be several kilometers tall.', example: 'They cleaned the solar panels of Spirit and Opportunity many times.', related: ['dust-storm'] },
  { id: 'atmospheric-pressure', term: 'Atmospheric Pressure', category: 'weather', def: 'How hard the air pushes on things. Mars’s air pressure is less than 1% of Earth’s, so astronauts need pressurized suits and habitats.', example: 'Curiosity’s REMS measures 700–900 pascals.', related: ['carbon-dioxide', 'spacesuit'] },
  { id: 'carbon-dioxide', term: 'Carbon Dioxide (CO₂)', category: 'weather', def: 'The gas we breathe out. Mars’s thin air is about 95% CO₂. In winter some of it freezes into dry-ice frost at the poles.', related: ['moxie', 'atmospheric-pressure', 'co2-scrubber'] },
  { id: 'scattering', term: 'Light Scattering', category: 'weather', def: 'When tiny particles bounce light in different directions. Martian dust makes the daytime sky butterscotch and sunsets blue.', related: ['tau'] },
  { id: 'rems', term: 'REMS', category: 'science', def: 'The Rover Environmental Monitoring Station, Curiosity’s weather station. It has recorded temperature, pressure, humidity, wind and UV almost every sol since 2012.', example: 'The weather in this game comes from REMS data.', related: ['atmospheric-pressure'] },

  // Radiation
  { id: 'radiation', term: 'Radiation', category: 'radiation', def: 'Energy moving through space as waves or fast particles. High-energy space radiation can damage cells and DNA.', related: ['galactic-cosmic-rays', 'sep', 'sievert'] },
  { id: 'galactic-cosmic-rays', term: 'Galactic Cosmic Rays (GCR)', category: 'radiation', def: 'Super-fast particles from exploded stars far outside our solar system. They are always there and are very hard to block.', related: ['radiation', 'radiation-shielding', 'rad'] },
  { id: 'sep', term: 'Solar Energetic Particles (SEP)', category: 'radiation', def: 'Bursts of fast protons blasted out by the Sun during flares and CMEs. They can arrive in under an hour, but a few centimeters of water or a shelter blocks most of them.', related: ['solar-flare', 'cme', 'storm-shelter'] },
  { id: 'solar-flare', term: 'Solar Flare', category: 'radiation', def: 'A sudden flash of energy on the Sun. Flares are ranked A, B, C, M and X, from weakest to strongest; each letter is 10 times stronger than the last.', example: 'An X-class flare on 20 May 2024 sent particles to Mars.', related: ['sep', 'cme', 'donki'] },
  { id: 'cme', term: 'Coronal Mass Ejection (CME)', category: 'radiation', def: 'A giant cloud of magnetized gas thrown off the Sun at up to 3,000 km per second. CMEs cause auroras and can push particles to dangerous energies.', related: ['solar-flare', 'aurora', 'solar-wind'] },
  { id: 'solar-wind', term: 'Solar Wind', category: 'radiation', def: 'A constant stream of charged particles flowing out from the Sun in all directions.', related: ['magnetosphere', 'cme'] },
  { id: 'sievert', term: 'Sievert (Sv) & Millisievert (mSv)', category: 'radiation', def: 'The unit for how much radiation harm a body receives. 1 sievert = 1,000 millisieverts. People on Earth get about 2.4 mSv a year from natural sources.', example: 'One sol on Mars’s surface is about 0.64 mSv, about 6 chest X-rays.', related: ['gray', 'dose-limit'] },
  { id: 'gray', term: 'Gray (Gy)', category: 'radiation', def: 'The unit for how much radiation energy is absorbed by each kilogram of material. Sieverts adjust grays for how harmful each type of radiation is.', related: ['sievert'] },
  { id: 'dose-limit', term: 'Career Dose Limit', category: 'radiation', def: 'NASA limits each astronaut to 600 millisieverts of radiation over their entire career to keep cancer risk low.', example: 'A round trip to Mars alone could use more than half of it.', related: ['sievert', 'radiation-shielding'] },
  { id: 'radiation-shielding', term: 'Radiation Shielding', category: 'radiation', def: 'Material placed between people and radiation. Water, plastic and regolith work well because they are full of light atoms like hydrogen.', related: ['regolith', 'storm-shelter', 'water-wall'] },
  { id: 'water-wall', term: 'Water Wall', category: 'radiation', def: 'Using stored water tanks as walls. Water is heavy in hydrogen, which makes it one of the best shields, and you need it anyway!', related: ['radiation-shielding'] },
  { id: 'storm-shelter', term: 'Storm Shelter', category: 'radiation', def: 'A small, extra-shielded room where the crew hides during a solar particle storm.', example: 'The Orion spacecraft turns its storage bay into a shelter.', related: ['sep', 'radiation-shielding'] },
  { id: 'aurora', term: 'Aurora', category: 'radiation', def: 'Glowing lights in the sky made when charged particles from the Sun hit a planet’s atmosphere. Mars has auroras too!', related: ['cme', 'magnetosphere'] },
  { id: 'rad', term: 'RAD (Radiation Assessment Detector)', category: 'science', def: 'The instrument on Curiosity that measures radiation on Mars’s surface. Its data tells NASA how much shielding astronauts will need.', related: ['galactic-cosmic-rays', 'sievert'] },
  { id: 'donki', term: 'DONKI', category: 'science', def: 'The Space Weather Database Of Notifications, Knowledge, Information, run by NASA’s Community Coordinated Modeling Center. It lists every solar flare, CME and particle storm.', example: 'Solar storms in this game are real events from DONKI.', related: ['solar-flare', 'cme', 'sep'] },

  // Life support
  { id: 'life-support', term: 'Life Support', category: 'life', def: 'All the systems that keep astronauts alive: oxygen, water, food, temperature, air pressure and getting rid of carbon dioxide.', related: ['eclss', 'bvad'] },
  { id: 'eclss', term: 'ECLSS', category: 'life', def: 'Environmental Control and Life Support System: the machines on a spacecraft or base that clean air, recycle water and control temperature.', example: 'The ISS recycles 98% of its water, including sweat and urine!', related: ['life-support', 'co2-scrubber', 'closed-loop'] },
  { id: 'bvad', term: 'BVAD', category: 'life', def: 'NASA’s Baseline Values and Assumptions Document: the official numbers for how much oxygen, water and food each astronaut needs per day.', example: 'About 0.82 kg of oxygen per person per day.', related: ['life-support'] },
  { id: 'electrolysis', term: 'Electrolysis', category: 'life', def: 'Using electricity to split water (H₂O) into hydrogen and oxygen gas. It is how the ISS makes breathing oxygen.', related: ['eclss', 'moxie'] },
  { id: 'co2-scrubber', term: 'CO₂ Scrubber', category: 'life', def: 'A machine that removes the carbon dioxide astronauts breathe out. Too much CO₂ causes headaches and worse.', example: 'Apollo 13’s crew built a famous scrubber fix out of duct tape and a sock.', related: ['carbon-dioxide', 'eclss'] },
  { id: 'closed-loop', term: 'Closed-Loop System', category: 'life', def: 'A system that recycles its own materials instead of throwing them away, like a base that turns used water back into drinking water.', related: ['eclss', 'hydroponics'] },
  { id: 'hydroponics', term: 'Hydroponics', category: 'life', def: 'Growing plants with their roots in nutrient-rich water instead of soil.', related: ['veggie', 'perchlorate', 'closed-loop'] },
  { id: 'veggie', term: 'Veggie', category: 'life', def: 'NASA’s plant growth system on the ISS. Astronauts have grown lettuce, cabbage, peppers and zinnia flowers in it.', related: ['hydroponics'] },
  { id: 'perchlorate', term: 'Perchlorate', category: 'life', def: 'A salty chemical in Martian soil that is toxic to people. It must be washed out before growing food in Mars dirt.', example: 'Discovered by NASA’s Phoenix lander in 2008.', related: ['regolith', 'hydroponics'] },
  { id: 'habitat', term: 'Habitat', category: 'life', def: 'The pressurized home where astronauts live and work. It must hold air in, keep temperatures comfortable and protect from radiation.', related: ['life-support', 'airlock'] },
  { id: 'airlock', term: 'Airlock', category: 'life', def: 'A small room with two doors that lets astronauts go outside without letting all the air out of the habitat.', related: ['habitat', 'eva'] },
  { id: 'spacesuit', term: 'Spacesuit', category: 'life', def: 'A personal spacecraft you wear. It provides air, pressure, temperature control and protection from dust and micrometeoroids.', example: 'NASA’s new Artemis moonwalking suits are called AxEMUs.', related: ['eva', 'atmospheric-pressure'] },

  // Power
  { id: 'solar-array', term: 'Solar Array', category: 'power', def: 'A set of solar panels that turn sunlight into electricity. They are light but stop working at night and get weaker as dust covers them.', related: ['tau', 'dust-storm', 'battery'] },
  { id: 'battery', term: 'Battery', category: 'power', def: 'Stores electrical energy to use later, like at night or during a storm. Batteries are heavy for the energy they hold.', related: ['solar-array', 'kwh'] },
  { id: 'kwh', term: 'Kilowatt & Kilowatt-hour', category: 'power', def: 'A kilowatt (kW) is how fast energy is used. A kilowatt-hour (kWh) is how much energy is used: 1 kW running for 1 hour.', example: 'A typical home uses about 30 kWh per day.', related: ['battery'] },
  { id: 'rtg', term: 'RTG', category: 'power', def: 'Radioisotope Thermoelectric Generator: a nuclear battery that turns heat from decaying plutonium into electricity for decades. Curiosity and Perseverance use one.', related: ['fission-surface-power'] },
  { id: 'fission-surface-power', term: 'Fission Surface Power', category: 'power', def: 'A small nuclear reactor NASA is developing to power Moon and Mars bases day and night, through dust storms and the lunar night.', example: 'NASA’s 2018 KRUSTY test proved a Kilopower reactor works.', related: ['rtg', 'lunar-night'] },
  { id: 'trade-off', term: 'Trade-off', category: 'mission', def: 'Giving up some of one thing to get more of another. Every mission design is full of trade-offs: more food means less room for equipment.', related: ['payload', 'redundancy'] },

  // ISRU
  { id: 'isru', term: 'ISRU', category: 'isru', def: 'In-Situ Resource Utilization: “living off the land” by making oxygen, water, fuel or building materials from local resources instead of bringing them from Earth.', related: ['moxie', 'water-ice'] },
  { id: 'moxie', term: 'MOXIE', category: 'isru', def: 'The Mars Oxygen In-Situ Resource Utilization Experiment on Perseverance. It made 122 grams of breathable oxygen from Mars’s CO₂ air between 2021 and 2023.', related: ['isru', 'carbon-dioxide', 'electrolysis'] },
  { id: 'water-ice', term: 'Water Ice', category: 'isru', def: 'Frozen water. It exists under the surface of Mars and in shadowed craters on the Moon, and could be mined for drinking water, oxygen and rocket fuel.', related: ['isru', 'psr', 'radar'] },
  { id: 'pre-deployment', term: 'Pre-deployment', category: 'isru', def: 'Sending cargo and equipment ahead of the crew so supplies are already waiting when astronauts land.', related: ['payload'] },

  // Missions & ops
  { id: 'eva', term: 'EVA (Spacewalk / Moonwalk)', category: 'mission', def: 'Extravehicular Activity: any time an astronaut goes outside in a spacesuit. EVAs are exciting but use more oxygen and expose the crew to more radiation.', related: ['spacesuit', 'airlock'] },
  { id: 'capcom', term: 'CAPCOM', category: 'mission', def: 'Capsule Communicator: the one person in Mission Control who talks directly to the astronauts.', related: ['light-delay'] },
  { id: 'light-delay', term: 'Light Delay', category: 'mission', def: 'The time radio signals take to travel between planets at the speed of light. Earth to Moon takes 1.3 seconds; Earth to Mars takes 3 to 22 minutes.', related: ['dsn', 'solar-conjunction'] },
  { id: 'dsn', term: 'Deep Space Network (DSN)', category: 'mission', def: 'NASA’s giant radio antennas in California, Spain and Australia that talk to faraway spacecraft. Together they can always see the sky in every direction.', related: ['light-delay'] },
  { id: 'payload', term: 'Payload & Mass Budget', category: 'mission', def: 'Payload is everything a rocket carries. Every kilogram costs fuel, so engineers set a strict mass budget.', related: ['trade-off', 'edl'] },
  { id: 'edl', term: 'EDL', category: 'mission', def: 'Entry, Descent and Landing: the “seven minutes of terror” when a spacecraft slows from 20,000 km/h to a gentle touchdown on Mars.', related: ['payload'] },
  { id: 'redundancy', term: 'Redundancy', category: 'mission', def: 'Having backups for important systems, so one failure does not end the mission.', example: 'Spare parts kits and two oxygen generators are redundancy.', related: ['trade-off'] },
  { id: 'artemis', term: 'Artemis', category: 'mission', def: 'NASA’s program to return humans to the Moon, near the south pole, and build toward sending astronauts to Mars.', related: ['psr', 'habitat'] },
  { id: 'hirise', term: 'HiRISE', category: 'science', def: 'The super-sharp camera on NASA’s Mars Reconnaissance Orbiter. It can spot objects the size of a kitchen table from orbit.', related: ['radar'] },

  // Body
  { id: 'low-gravity', term: 'Low Gravity', category: 'body', def: 'Gravity weaker than Earth’s. It is fun for jumping, but over time it weakens bones, muscles and even eyesight.', related: ['bone-loss', 'gravity'] },
  { id: 'bone-loss', term: 'Bone Loss', category: 'body', def: 'In low gravity, bones lose about 1% of their mass per month unless astronauts exercise hard every day.', related: ['low-gravity'] },
  { id: 'behavioral-health', term: 'Behavioral Health', category: 'body', def: 'Taking care of the mind on long missions: sleep, teamwork, staying in touch with family, and having fun.', related: ['capcom'] },

  // Science tools
  { id: 'spectrometer', term: 'Spectrometer', category: 'science', def: 'An instrument that splits light into colors to figure out what something is made of.', related: ['meteorite'] },
  { id: 'radar', term: 'Ground-Penetrating Radar', category: 'science', def: 'Radio waves that bounce off layers underground, showing buried ice or rock. Perseverance carries one called RIMFAX.', related: ['water-ice'] },
  { id: 'seismometer', term: 'Seismometer', category: 'science', def: 'An instrument that feels ground shaking. InSight’s seismometer detected over 1,300 marsquakes.', related: ['moonquake'] },
  { id: 'meteorite', term: 'Meteorite', category: 'science', def: 'A space rock that survived falling onto a planet’s surface.', related: ['spectrometer', 'crater'] },
  { id: 'micrometeoroid', term: 'Micrometeoroid', category: 'planet', def: 'A speck of space rock or dust, smaller than a grain of sand, moving at tens of kilometers per second.', related: ['whipple-shield'] },
  { id: 'whipple-shield', term: 'Whipple Shield', category: 'mission', def: 'A layered shield with gaps between thin walls. A micrometeoroid shatters on the first layer and the spray is stopped by the next.', related: ['micrometeoroid'] },
  { id: 'moonquake', term: 'Moonquake', category: 'planet', def: 'A quake on the Moon. Apollo seismometers found that shallow moonquakes can last more than 10 minutes.', related: ['seismometer'] },
];

export const termById = (id) => GLOSSARY.find((t) => t.id === id) ?? null;

export function searchGlossary(query, category = 'all') {
  const q = query.trim().toLowerCase();
  return GLOSSARY.filter((t) => (category === 'all' || t.category === category)
    && (!q || t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q)))
    .sort((a, b) => a.term.localeCompare(b.term));
}

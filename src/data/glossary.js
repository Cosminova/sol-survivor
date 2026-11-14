// Kid-friendly glossary. Every [[term]] link, module `term` and card `terms` entry resolves here.
// short: one sentence a 9-year-old understands. long: a real fact or two. source: an id from SOURCES
// when a number or fact comes from that reference.
export const GLOSSARY = {
  'atmospheric-pressure': {
    id: 'atmospheric-pressure', name: 'Air pressure',
    short: 'How hard the air pushes on everything. Mars air pushes more than 100 times less than Earth’s air.',
    long: 'Curiosity’s REMS station measures roughly 700 to 900 pascals at Gale Crater; Earth at sea level is about 101,000. Mars pressure rises and falls with the seasons as carbon dioxide freezes and thaws at the poles.',
    source: 'rems',
  },
  aurora: {
    id: 'aurora', name: 'Aurora',
    short: 'Glowing lights in the night sky made when particles from the Sun crash into a planet’s air.',
    long: 'On Earth auroras appear near the poles because the magnetic field steers particles there. Mars has no global magnetic field, so a Martian aurora can spread across the whole sky.',
  },
  battery: {
    id: 'battery', name: 'Battery',
    short: 'A box that stores electricity now so you can use it later, at night or during a dust storm.',
    long: 'The game’s Battery Bank holds 100 kilowatt-hours. That can run the 3-kilowatt habitat for more than one sol with everything else switched off.',
  },
  'battery-bank': {
    id: 'battery-bank', name: 'Battery bank',
    short: 'Lots of batteries wired together so the outpost can save up a big pile of energy.',
    long: 'Solar power only arrives in daytime, so a base needs enough stored energy to stay warm through every night. On the Moon a night lasts two weeks.',
  },
  'behavioral-health': {
    id: 'behavioral-health', name: 'Behavioral health',
    short: 'How people feel and get along. Lonely, bored or stressed astronauts make more mistakes.',
    long: 'NASA studies behavioral health because a Mars crew will be far from home for years. Fresh food, video calls home and celebrations all help.',
    source: 'veggie',
  },
  'bone-loss': {
    id: 'bone-loss', name: 'Bone loss',
    short: 'In low gravity bones get weaker because they no longer have to carry your weight.',
    long: 'Astronauts in weightlessness can lose about 1% of bone mass each month, so ISS crews exercise about two hours every day to stay strong.',
  },
  'carbon-dioxide': {
    id: 'carbon-dioxide', name: 'Carbon dioxide (CO₂)',
    short: 'The gas that makes up about 95% of Mars air. We breathe it out; plants breathe it in.',
    long: 'Each Martian winter so much CO₂ freezes at the poles that the whole planet’s air pressure drops. MOXIE split this same gas to make oxygen.',
    source: 'mars-fact',
  },
  'dust-devil': {
    id: 'dust-devil', name: 'Dust devil',
    short: 'A spinning column of wind and dust, like a mini tornado. It often blows the dust off solar panels.',
    long: 'The Spirit and Opportunity rovers lasted years longer than planned partly because dust devils and gusts scrubbed their panels clean.',
    source: 'mer-dust',
  },
  'dust-storm': {
    id: 'dust-storm', name: 'Dust storm',
    short: 'A giant cloud of fine dust blown around by Martian wind. It dims the Sun and can last for weeks.',
    long: 'Most storms happen in southern spring and summer. In 2018 a planet-wide storm pushed dust opacity to about 10.8 and ended the solar-powered Opportunity rover’s mission.',
    source: 'opportunity',
  },
  eclipse: {
    id: 'eclipse', name: 'Eclipse',
    short: 'When one object in space blocks the light of another, like a moon passing in front of the Sun.',
    long: 'Mars’ moon Phobos is too small to hide the Sun completely, so its eclipses last only about 40 seconds and look like a bite out of the Sun.',
  },
  eclss: {
    id: 'eclss', name: 'ECLSS (life support system)',
    short: 'The machines that clean the air, recycle water and keep the habitat safe to live in.',
    long: 'ECLSS stands for Environmental Control and Life Support System. On the International Space Station it now recovers about 98% of the water the crew uses, including sweat and urine.',
    source: 'eclss',
  },
  edl: {
    id: 'edl', name: 'EDL (Entry, Descent and Landing)',
    short: 'The scary few minutes when a spacecraft slows from thousands of kilometers per hour to a soft landing.',
    long: 'In 2021 Perseverance went from about 20,000 km/h to a standstill in about seven minutes using a heat shield, a parachute and a rocket-powered sky crane.',
  },
  electrolysis: {
    id: 'electrolysis', name: 'Electrolysis',
    short: 'Using electricity to split water into hydrogen gas and oxygen gas you can breathe.',
    long: 'One kilogram of water gives about 0.89 kg of oxygen. The International Space Station makes most of its breathing oxygen this way.',
    source: 'eclss',
  },
  eva: {
    id: 'eva', name: 'EVA (spacewalk)',
    short: 'Extravehicular Activity: any time an astronaut puts on a suit and goes outside the habitat.',
    long: 'Working on an EVA is hard exercise, so astronauts breathe about 30% more oxygen. Outside the habitat walls they also collect more radiation.',
    source: 'bvad',
  },
  'fission-surface-power': {
    id: 'fission-surface-power', name: 'Fission Surface Power',
    short: 'A small nuclear reactor that makes steady electricity day and night, through dust storms and the long lunar night.',
    long: 'NASA’s Fission Surface Power project is designing a 40-kilowatt reactor that could run on the Moon for ten years without refueling.',
    source: 'kilopower',
  },
  'galactic-cosmic-rays': {
    id: 'galactic-cosmic-rays', name: 'Galactic cosmic rays (GCR)',
    short: 'Super-fast atomic particles from exploded stars far away. They hit Mars all the time and are hard to block.',
    long: 'Curiosity’s RAD instrument measured about 0.64 millisieverts per sol from cosmic rays on the Martian surface. Thick rock or regolith overhead blocks much of it.',
    source: 'rad-2014',
  },
  hirise: {
    id: 'hirise', name: 'HiRISE camera',
    short: 'A camera on NASA’s Mars Reconnaissance Orbiter that can spot things on Mars as small as a kitchen table.',
    long: 'HiRISE pictures help rover drivers avoid sand traps, and they revealed icy cliffs that show buried ice sheets.',
    source: 'ice',
  },
  hydroponics: {
    id: 'hydroponics', name: 'Hydroponics',
    short: 'Growing plants in water full of nutrients instead of in soil.',
    long: 'NASA’s Veggie system on the ISS grows plants in small “pillows” of clay and fertilizer with water. No dirt needed.',
    source: 'veggie',
  },
  isru: {
    id: 'isru', name: 'ISRU (living off the land)',
    short: 'Making what you need from local stuff, like oxygen from Mars air or water from buried ice.',
    long: 'ISRU stands for In-Situ Resource Utilization. MOXIE proved it works by making 122 grams of oxygen from Martian CO₂. Moon rock is about 40% oxygen by weight.',
    source: 'moxie',
  },
  'kilowatt-hour': {
    id: 'kilowatt-hour', name: 'Kilowatt-hour (kWh)',
    short: 'A unit of energy. One kilowatt-hour runs a 1,000-watt heater for one hour.',
    long: 'A typical home uses around 30 kWh a day. The game’s habitat needs 3 kilowatts all the time, about 74 kWh per sol, before you add any machines.',
  },
  'lava-tube': {
    id: 'lava-tube', name: 'Lava tube',
    short: 'A cave left behind by flowing lava long ago. Its thick rock roof could shield a base from radiation.',
    long: 'Orbiters have photographed hundreds of pits (skylights) on the Moon and Mars. In the Moon’s weak gravity, lava tubes could be hundreds of meters wide.',
  },
  'life-support': {
    id: 'life-support', name: 'Life support',
    short: 'Everything that keeps the crew alive: air to breathe, water to drink, food, and a comfortable temperature.',
    long: 'NASA plans on about 0.82 kg of oxygen, 3.5 kg of water and 1.8 kg of food per astronaut per day.',
    source: 'bvad',
  },
  'light-delay': {
    id: 'light-delay', name: 'Light delay',
    short: 'Radio messages travel at light speed, but space is so big that they still take time to arrive.',
    long: 'From Mars a message takes 3 to 22 minutes one way, depending on where the planets are. From the Moon it takes about 1.3 seconds.',
    source: 'jpl-elements',
  },
  'low-gravity': {
    id: 'low-gravity', name: 'Low gravity',
    short: 'Mars pulls you down with 38% of Earth’s gravity and the Moon with 17%. You could jump much higher!',
    long: 'Weak gravity is fun, but it slowly weakens bones and muscles, so astronauts must exercise every day.',
    source: 'mars-fact',
  },
  'lunar-night': {
    id: 'lunar-night', name: 'Lunar night',
    short: 'On the Moon, night lasts about 14 Earth days. Solar panels make nothing and it gets colder than −130 °C.',
    long: 'One full lunar day-night cycle takes 29.5 Earth days. Near the South Pole a few high ridges stay sunlit most of the time.',
    source: 'moon-fact',
  },
  magnetosphere: {
    id: 'magnetosphere', name: 'Magnetosphere',
    short: 'An invisible magnetic bubble around a planet that pushes away particles from the Sun.',
    long: 'Earth has a strong one. Mars lost its global magnetic field billions of years ago, so solar particles reach its surface more easily.',
  },
  meteorite: {
    id: 'meteorite', name: 'Meteorite',
    short: 'A rock from space that survives the fall through the air and lands on a planet’s surface.',
    long: 'Curiosity found an iron-nickel meteorite nicknamed “Egg Rock” in 2016. Shiny iron meteorites last a long time on dry Mars.',
  },
  micrometeoroid: {
    id: 'micrometeoroid', name: 'Micrometeoroid',
    short: 'A speck of space rock smaller than a grain of sand, moving faster than a bullet.',
    long: 'With no air to slow them down, micrometeoroids hit the Moon at around 20 kilometers per second, so habitats need tough layered walls.',
    source: 'moon-fact',
  },
  moonquake: {
    id: 'moonquake', name: 'Moonquake',
    short: 'An earthquake on the Moon. The Moon shakes a little as it cools and as Earth’s gravity squeezes it.',
    long: 'Seismometers left by Apollo astronauts recorded thousands of moonquakes between 1969 and 1977. Shallow ones can rattle for over ten minutes.',
  },
  morale: {
    id: 'morale', name: 'Morale',
    short: 'How happy and hopeful the crew feels. Low morale makes people tired, grumpy and more likely to make mistakes.',
    long: 'In the game morale slips a little every sol and rises with fresh food, calls home and celebrations, just like for real crews.',
  },
  moxie: {
    id: 'moxie', name: 'MOXIE',
    short: 'A toaster-sized machine on the Perseverance rover that made breathable oxygen out of Mars’ carbon dioxide air.',
    long: 'Between 2021 and 2023 MOXIE produced 122 grams of oxygen, up to 12 grams per hour, proving astronauts could make their own air on Mars.',
    source: 'moxie',
  },
  oxygen: {
    id: 'oxygen', name: 'Oxygen',
    short: 'The gas we must breathe. Each astronaut uses about 0.82 kg of oxygen every day.',
    long: 'Mars air is only about 0.1% oxygen, so crews must bring it, split it out of water, or pull it out of the carbon dioxide air.',
    source: 'bvad',
  },
  perchlorate: {
    id: 'perchlorate', name: 'Perchlorate',
    short: 'A salty chemical in Martian soil that is poisonous to people and bad for plants.',
    long: 'NASA’s Phoenix lander found perchlorate in 2008, about half a percent of the soil. Future farms will need to wash the soil or grow without it.',
    source: 'phoenix',
  },
  phobos: {
    id: 'phobos', name: 'Phobos',
    short: 'Mars’ bigger moon, shaped like a potato and only about 22 km across. It circles Mars three times a day.',
    long: 'Phobos is slowly spiraling inward. In about 50 million years it will break apart into a ring or crash into Mars.',
    source: 'mars-fact',
  },
  'pre-deployment': {
    id: 'pre-deployment', name: 'Pre-deployment',
    short: 'Sending supplies and equipment ahead so they are already waiting when the astronauts land.',
    long: 'NASA’s Mars plans land cargo and power systems one launch window, about 26 months, before the crew arrives.',
    source: 'mars-sites',
  },
  radar: {
    id: 'radar', name: 'Radar',
    short: 'A tool that bounces radio waves off things to find what is hidden, like ice buried underground.',
    long: 'The SHARAD radar on Mars Reconnaissance Orbiter can see hundreds of meters below the surface and found huge buried ice sheets.',
    source: 'ice',
  },
  'radiation-dose': {
    id: 'radiation-dose', name: 'Radiation dose',
    short: 'How much radiation energy your body has soaked up, measured in millisieverts (mSv).',
    long: 'A chest X-ray is about 0.1 mSv. On Mars a crew member collects about 0.64 mSv per sol from cosmic rays, and much more during a solar storm.',
    source: 'rad-2014',
  },
  redundancy: {
    id: 'redundancy', name: 'Redundancy',
    short: 'Having a backup for every important machine so one breakdown does not end the mission.',
    long: 'NASA designs life support with spares and backups because help from Earth is many months away.',
  },
  regolith: {
    id: 'regolith', name: 'Regolith',
    short: 'The loose dust, sand and broken rock covering the Moon and Mars. It is not soil, because nothing lives in it.',
    long: 'Piling regolith over a habitat blocks radiation. Moon regolith is about 40% oxygen by weight, locked inside its minerals.',
    source: 'artemis',
  },
  rtg: {
    id: 'rtg', name: 'RTG (nuclear battery)',
    short: 'A nuclear “battery” that turns the heat of slowly decaying plutonium into electricity, day or night.',
    long: 'RTG stands for Radioisotope Thermoelectric Generator. Curiosity and Perseverance each carry one, which is why Curiosity kept working through the 2018 global dust storm.',
    source: 'opportunity',
  },
  scattering: {
    id: 'scattering', name: 'Scattering',
    short: 'When tiny particles bounce light in new directions. It makes Earth’s sky blue and Mars’ sky butterscotch.',
    long: 'Martian dust scatters blue light forward toward the Sun, so a Mars sunset glows blue right around the Sun.',
  },
  seismometer: {
    id: 'seismometer', name: 'Seismometer',
    short: 'An instrument that feels tiny shakes in the ground, used to study quakes and what is inside a planet.',
    long: 'NASA’s InSight lander recorded more than 1,300 marsquakes between 2018 and 2022.',
  },
  sep: {
    id: 'sep', name: 'SEP (solar energetic particles)',
    short: 'Fast particles fired out by the Sun during a flare or eruption. They reach Mars in hours and are dangerous to astronauts.',
    long: 'The game’s storm alerts replay 179 real SEP events from NASA’s DONKI database for 2024–2025. Water, regolith or a storm shelter block most of them.',
    source: 'donki',
  },
  sievert: {
    id: 'sievert', name: 'Sievert (Sv)',
    short: 'The unit for radiation dose. A millisievert (mSv) is one thousandth of a sievert.',
    long: 'NASA limits an astronaut’s whole career to 600 mSv. A six-month trip to Mars adds about 330 mSv before you even land.',
    source: 'nasa-std-3001',
  },
  sol: {
    id: 'sol', name: 'Sol',
    short: 'One Mars day: 24 hours and 39 minutes, about 40 minutes longer than an Earth day.',
    long: 'Mission teams count sols from landing day. Curiosity’s weather record in this game covers more than 4,700 sols.',
    source: 'mars-fact',
  },
  'solar-array': {
    id: 'solar-array', name: 'Solar array',
    short: 'A group of solar panels that turn sunlight into electricity. Dust and darkness cut their power.',
    long: 'Mars gets less than half the sunlight Earth does, and settling dust steals roughly 0.1–0.3% of panel output every sol.',
    source: 'mer-dust',
  },
  'solar-conjunction': {
    id: 'solar-conjunction', name: 'Solar conjunction',
    short: 'When the Sun sits between Earth and Mars and blocks radio messages for about two weeks.',
    long: 'It happens about every 26 months. NASA stops sending commands to its Mars rovers because the Sun’s hot gas can scramble them.',
    source: 'jpl-elements',
  },
  'solar-flare': {
    id: 'solar-flare', name: 'Solar flare',
    short: 'A sudden bright flash on the Sun that blasts out light and energy. Classes go C, M, then X for the strongest.',
    long: 'An X-class flare is ten times stronger than an M-class one. The game’s 2024–2025 DONKI record holds about 1,600 flares.',
    source: 'donki',
  },
  'solar-longitude': {
    id: 'solar-longitude', name: 'Solar longitude (Ls)',
    short: 'The Mars season clock, from 0° to 360°. Ls 0° starts northern spring; Ls 180° starts northern autumn.',
    long: 'A Mars year lasts 687 Earth days, so each season is about twice as long as on Earth. Dust storm season runs from about Ls 180° to 330°.',
    source: 'mars24',
  },
  spectrometer: {
    id: 'spectrometer', name: 'Spectrometer',
    short: 'An instrument that splits light into a rainbow to work out what something is made of.',
    long: 'Curiosity’s ChemCam zaps rocks with a laser and reads the glowing spark to identify elements such as iron and nickel.',
  },
  'storm-shelter': {
    id: 'storm-shelter', name: 'Storm shelter',
    short: 'A small room with extra-thick walls where the crew hides during a solar radiation storm.',
    long: 'Water tanks, bags of regolith and supplies packed around a core room can block about 95% of solar particle radiation.',
    source: 'rad-2014',
  },
  tau: {
    id: 'tau', name: 'Tau (dust opacity)',
    short: 'A number for how dusty the sky is. Tau 0.5 is a clear day; tau 10 means the Sun almost disappears.',
    long: 'Each unit of tau cuts direct sunlight by about 63%. Opportunity measured a record tau of about 10.8 during the 2018 global storm.',
    source: 'opportunity',
  },
  'tidal-locking': {
    id: 'tidal-locking', name: 'Tidal locking',
    short: 'When a moon always shows the same face to its planet because it spins exactly once per orbit.',
    long: 'That is why we only ever see one side of the Moon from Earth, and why Earth barely moves in the lunar sky.',
    source: 'moon-fact',
  },
  veggie: {
    id: 'veggie', name: 'Veggie',
    short: 'NASA’s small plant-growing box on the International Space Station where astronauts grow lettuce and flowers.',
    long: 'In 2015 astronauts ate the first salad grown in space from Veggie. Fresh food adds vitamins and cheers up the crew.',
    source: 'veggie',
  },
  'water-ice': {
    id: 'water-ice', name: 'Water ice',
    short: 'Frozen water hidden under the ground on Mars and inside dark craters on the Moon. Melt it to drink or make oxygen.',
    long: 'LCROSS crashed into Cabeus crater in 2009 and found water in the splash. On Mars, cliffs show ice sheets starting about a meter down.',
    source: 'lcross',
  },
  'whipple-shield': {
    id: 'whipple-shield', name: 'Whipple shield',
    short: 'A wall made of layers with gaps. The outer layer shatters a space rock so the inner layer can stop the pieces.',
    long: 'Invented by Fred Whipple in 1947, these shields protect the ISS from debris and could protect lunar habitats too.',
  },
};

export const termById = (id) => GLOSSARY[id] ?? null;

export const GLOSSARY_TERMS = Object.values(GLOSSARY).sort((a, b) => a.name.localeCompare(b.name));

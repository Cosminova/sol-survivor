// Event deck. Text may contain [[term-id]] or [[term-id|label]] glossary links.
// A card may also carry `worlds` (true, or a test on the world profile) or `hazard` (a world hazard id):
// those let it appear on worlds other than the Moon and Mars (src/engine/events.js). `bodies` is unchanged.
// effects are declarative so the engine stays pure and the UI can preview them.
export const EVENT_CARDS = [
  {
    id: 'sep_alert', icon: '☀️', title: 'Solar Radiation Storm Alert!', bodies: ['mars', 'moon'], weight: 0,
    body: 'Space weather forecasters report a {flareClass} [[solar-flare|solar flare]] and a burst of [[sep|solar energetic particles]] racing outward. Particles arrive within hours. Do you take cover?',
    science: 'This alert replays a real event from NASA’s DONKI database on {eventDate}. On 20 May 2024 Curiosity’s RAD instrument measured 8,100 micrograys on Mars during a storm like this, about the same as 30 chest X-rays.',
    source: 'donki', terms: ['sep', 'solar-flare', 'sievert', 'storm-shelter'],
    choices: [
      { label: 'Everyone into the storm shelter', requires: { module: 'shelter' }, effects: { shelter: true, morale: -2 }, outcome: 'The crew squeezes into the shelter and plays cards while particles slam into the walls outside.' },
      { label: 'Huddle behind the water tanks and supplies', effects: { shelter: 'partial', morale: -1 }, outcome: 'Water is great shielding. The crew camps out in the middle of the habitat, surrounded by tanks.' },
      { label: 'Keep working, the schedule matters', effects: { science: 4 }, outcome: 'Work continues… but every crew member soaks up the full dose.' },
    ],
  },
  {
    id: 'dust_storm', icon: '🌪️', title: 'Dust Storm Rolling In', bodies: ['mars'], weight: 0,
    body: 'Orbiters spot a regional [[dust-storm|dust storm]] heading your way. The sky will turn dark orange and the [[tau|dust opacity]] will climb. Solar panels will make much less power.',
    science: 'Mars dust storms happen most in southern spring and summer (Ls 180°–330°). In 2018 a planet-wide storm pushed tau to about 10.8 and ended the solar-powered Opportunity rover’s 15-year mission.',
    source: 'opportunity', terms: ['dust-storm', 'tau', 'solar-longitude', 'solar-array'],
    choices: [
      { label: 'Switch off the greenhouse lights to save power', effects: { storm: { tau: 3, sols: 10 }, disable: 'greenhouse' }, outcome: 'The plants will be dark for a while, but life support is safe.' },
      { label: 'Fill the batteries now and ride it out', effects: { storm: { tau: 3, sols: 10 }, battery: 40 }, outcome: 'The crew tops off the batteries while the sun still shines.' },
      { label: 'Do an EVA to tie down and clean the panels', effects: { storm: { tau: 3, sols: 10 }, dust: -0.2, dose: 0.3, morale: 2 }, outcome: 'Panels are sparkling clean as the first dust arrives.' },
    ],
  },
  {
    id: 'global_storm', icon: '🌑', title: 'Planet-Encircling Dust Storm', bodies: ['mars'], weight: 0, once: true,
    body: 'This one is huge. The dust storm is wrapping around the whole planet. Tau may reach 8 or more for weeks. Solar power will almost disappear.',
    science: 'Global dust storms strike every few Mars years. Nuclear power (like the [[rtg|RTG]] on Curiosity and Perseverance) keeps working in the dark, which is why Curiosity kept roving during the 2018 storm.',
    source: 'opportunity', terms: ['dust-storm', 'tau', 'rtg', 'fission-surface-power'],
    choices: [
      { label: 'Power down everything except life support', effects: { storm: { tau: 8, sols: 25 }, disable: ['greenhouse', 'rover', 'relay', 'moxie', 'iceDrill'] }, outcome: 'The base goes quiet. Only the life support hums.' },
      { label: 'Keep systems running and hope', effects: { storm: { tau: 8, sols: 25 } }, outcome: 'Mission Control is nervous. Watch your battery!' },
    ],
  },
  {
    id: 'dust_devil', icon: '🌀', title: 'A Dust Devil Cleans the Panels!', bodies: ['mars'], weight: 3,
    condition: (m) => m.env.dust > 0.08,
    body: 'A spinning [[dust-devil|dust devil]] swept right over your solar arrays and blew most of the dust away!',
    science: 'Spirit and Opportunity were saved many times by “cleaning events” when dust devils or gusts scrubbed their panels. Spirit’s power jumped by more than 50% in 2005 thanks to one.',
    source: 'mer-dust', terms: ['dust-devil', 'solar-array'],
    choices: [{ label: 'Lucky us!', effects: { dust: -0.6, morale: 3 }, outcome: 'Power output jumps back up.' }],
  },
  {
    id: 'perchlorate', icon: '⚠️', title: 'Toxic Salt in the Soil', bodies: ['mars'], weight: 2, once: true,
    condition: (m) => (m.modules.greenhouse ?? 0) > 0,
    body: 'Lab tests show the local soil has [[perchlorate|perchlorate]] salts, which are toxic to people and plants. The greenhouse was about to use this soil.',
    science: 'NASA’s Phoenix lander discovered perchlorate in Martian soil in 2008. Future farms will need to wash the soil or grow plants in water without soil ([[hydroponics]]).',
    source: 'phoenix', terms: ['perchlorate', 'regolith', 'hydroponics'],
    choices: [
      { label: 'Wash the soil with water (costs 120 kg water)', effects: { water: -120 }, outcome: 'Clean soil! The plants are safe.' },
      { label: 'Switch to hydroponics (uses more power)', effects: { greenhouseKw: 1 }, outcome: 'Roots now grow in nutrient water. Each greenhouse draws 1 kW more.' },
      { label: 'Use the soil anyway', effects: { perchlorate: true }, outcome: 'Plants grow poorly. Harvests are cut in half.' },
    ],
  },
  {
    id: 'ice_found', worlds: (p) => p.iceAccess > 0 && p.liquidWater !== 'surface', icon: '🧊', title: 'Buried Ice Discovered', bodies: ['mars', 'moon'], weight: 2, once: true,
    body: 'Ground-penetrating radar finds a thick layer of [[water-ice|water ice]] close to the surface near the base!',
    science: 'Radar on NASA’s Mars Reconnaissance Orbiter (SHARAD) and HiRISE images of icy cliffs show huge buried ice sheets on Mars. On the Moon, LCROSS found ice in a shadowed crater in 2009.',
    source: 'ice', terms: ['water-ice', 'isru', 'radar'],
    choices: [
      { label: 'Map it for the ice drill (+50% drill output)', effects: { iceBonus: 0.5, science: 6 }, outcome: 'The drill team has a new target.' },
      { label: 'Study it for clues about ancient climate', effects: { science: 15 }, outcome: 'Layers in the ice record climate history, like tree rings.' },
    ],
  },
  {
    id: 'meteorite', icon: '☄️', title: 'Strange Shiny Rock', bodies: ['mars'], weight: 2, once: true,
    body: 'An EVA team spots a dark, shiny rock that looks nothing like its neighbors. It might be an iron [[meteorite]]!',
    science: 'Curiosity found an iron-nickel meteorite nicknamed “Egg Rock” in 2016, and another called “Cacao” in 2023. Meteorites tell us about the early solar system.',
    source: 'images', terms: ['meteorite', 'spectrometer'],
    choices: [
      { label: 'Analyze it with the spectrometer', effects: { science: 12, morale: 3 }, outcome: 'Iron and nickel confirmed. It fell from space long ago!' },
      { label: 'Log the location and keep moving', effects: { science: 3 }, outcome: 'A future crew can study it.' },
    ],
  },
  {
    id: 'micrometeoroid', hazard: 'micrometeoroids', icon: '💥', title: 'Micrometeoroid Strike!', bodies: ['moon'], weight: 2,
    body: 'A [[micrometeoroid]] smaller than a grain of sand hit the habitat at 20 km per second. Alarm! There is a slow air leak.',
    science: 'With no air to slow them down, tiny space rocks hit the Moon constantly. NASA designs habitats and spacesuits with layered “Whipple shields” to stop them.',
    source: 'moon-fact', terms: ['micrometeoroid', 'whipple-shield'],
    choices: [
      { label: 'Use a spare parts kit to patch it', requires: { spares: 1 }, effects: { spares: -1 }, outcome: 'Leak sealed in minutes.' },
      { label: 'Emergency EVA patch with tape and foam', effects: { o2: -6, dose: 0.5, morale: -2 }, outcome: 'It holds, but some oxygen escaped.' },
    ],
  },
  {
    id: 'moonquake', icon: '📳', title: 'Moonquake!', bodies: ['moon'], weight: 1, once: true,
    body: 'The habitat shakes for almost ten minutes. A shallow [[moonquake]]! Shelves rattle, but the structure holds.',
    science: 'Seismometers left by Apollo astronauts (1969–1977) recorded thousands of moonquakes. Shallow ones can last over 10 minutes because the dry Moon rings like a bell.',
    source: 'moon-fact', terms: ['moonquake', 'seismometer'],
    choices: [
      { label: 'Inspect every system (one crew-sol of work)', effects: { repairAll: true, science: 4 }, outcome: 'All clear, and the seismometer data is gold for scientists.' },
      { label: 'Seems fine, keep going', effects: { breakChance: 0.5 }, outcome: 'Hopefully nothing was damaged…' },
    ],
  },
  {
    id: 'conjunction', icon: '🌞', title: 'Solar Conjunction Blackout', bodies: ['mars'], weight: 1, once: true,
    body: 'The Sun is about to pass between Earth and Mars. For about two weeks, radio signals will be scrambled. You will be on your own: no messages from Mission Control.',
    science: '[[solar-conjunction|Solar conjunction]] happens about every 26 months. NASA pauses commands to rovers during it, because the Sun’s hot gas can corrupt signals.',
    source: 'jpl-elements', terms: ['solar-conjunction', 'light-delay'],
    choices: [
      { label: 'Record video diaries to send home later', effects: { blackout: 14, morale: -2, science: 3 }, outcome: 'The crew keeps busy and focused.' },
      { label: 'Plan a crew movie night every few sols', effects: { blackout: 14, morale: 2 }, outcome: 'Popcorn is rationed, but spirits are high.' },
    ],
  },
  {
    id: 'birthday', worlds: (p) => p.system === 'sol', icon: '🎂', title: 'Birthday on {bodyName}!', bodies: ['mars', 'moon'], weight: 2, once: true,
    body: '{crewName} has a birthday today. The crew wants to celebrate.',
    science: 'Food and celebrations matter for mental health on long missions. Astronauts on the ISS celebrate holidays and birthdays together, sometimes with fresh food from the [[veggie|Veggie]] garden.',
    source: 'veggie', terms: ['veggie', 'behavioral-health'],
    choices: [
      { label: 'Bake a cake (uses 5 kg food)', effects: { food: -5, morale: 10 }, outcome: 'Best birthday ever, even in low gravity.' },
      { label: 'Sing and send a video home', effects: { morale: 5 }, outcome: 'Family on Earth sends a reply… minutes later.' },
    ],
  },
  {
    id: 'homesick', icon: '🏠', title: 'Missing Home', bodies: ['mars', 'moon'], weight: 2,
    condition: (m) => avgMorale(m) < 70,
    body: 'The crew is feeling homesick. A live call home would help, but the [[light-delay|light delay]] means every reply takes minutes to arrive.',
    science: 'Radio signals travel at the speed of light. From Mars they take between 3 and 22 minutes to reach Earth, depending on where the planets are in their orbits.',
    source: 'jpl-elements', terms: ['light-delay', 'behavioral-health'],
    choices: [
      { label: 'Exchange recorded video letters', effects: { morale: 8 }, outcome: 'Faces from home on the screen. Everyone smiles.' },
      { label: 'Give everyone an extra rest sol', effects: { morale: 6, health: 3, science: -3 }, outcome: 'A lazy sol with books and music.' },
    ],
  },
  {
    id: 'blue_sunset', icon: '🌅', title: 'A Blue Sunset', bodies: ['mars'], weight: 2, once: true,
    body: 'The crew gathers at the window: the Martian sunset is BLUE.',
    science: 'Fine Martian dust scatters blue light forward, close to the Sun. Curiosity photographed a blue sunset in Gale Crater in 2015. During the day the Martian sky looks butterscotch.',
    source: 'images', terms: ['scattering'],
    choices: [{ label: 'Take photos for Earth', effects: { morale: 6, science: 2 }, outcome: 'The photo goes viral back home.' }],
  },
  {
    id: 'earthrise', icon: '🌍', title: 'Earth in the Sky', bodies: ['moon'], weight: 2, once: true,
    body: 'From the habitat window, Earth hangs blue and white above the horizon.',
    science: 'The famous “Earthrise” photo was taken by Apollo 8 astronaut Bill Anders in 1968. From one spot on the Moon, Earth barely moves in the sky because the Moon always shows Earth the same face ([[tidal-locking|tidal locking]]).',
    source: 'images', terms: ['tidal-locking'],
    choices: [{ label: 'Call home and wave', effects: { morale: 6 }, outcome: 'Only 1.3 seconds of light delay. Nearly a normal phone call!' }],
  },
  {
    id: 'frost', icon: '❄️', title: 'Morning Frost', bodies: ['mars'], weight: 2, once: true,
    condition: (m) => m.env.minC < -80,
    body: 'The crew wakes to a thin white layer of frost on the ground outside. Some of it is frozen [[carbon-dioxide|carbon dioxide]], also known as dry ice!',
    science: 'Viking 2 photographed frost at Utopia Planitia in 1979. In winter so much CO₂ freezes at the poles that the whole planet’s air pressure drops by about 25%. You can see this in Curiosity’s REMS pressure data!',
    source: 'rems', terms: ['carbon-dioxide', 'atmospheric-pressure'],
    choices: [{ label: 'Sample it', effects: { science: 6 }, outcome: 'Frost samples stored for the lab.' }],
  },
  {
    id: 'rover_stuck', worlds: true, icon: '🚙', title: 'Rover Stuck in Sand', bodies: ['mars', 'moon'], weight: 2, once: true,
    condition: (m) => (m.modules.rover ?? 0) > 0,
    body: 'The rover sank up to its wheel hubs in a soft sand trap!',
    science: 'Spirit got stuck in soft soil in 2009 and never escaped. It became a stationary science station. Rover drivers now study orbital images (like HiRISE) to avoid sand traps.',
    source: 'images', terms: ['regolith', 'hirise'],
    choices: [
      { label: 'Dig it out on EVA (extra radiation dose)', effects: { dose: 0.8, morale: -1 }, outcome: 'Shovels and boards get it free.' },
      { label: 'Leave it for now (rover unavailable 6 sols)', effects: { disableSols: { id: 'rover', sols: 6 } }, outcome: 'Science slows down for a while.' },
    ],
  },
  {
    id: 'filter_clog', worlds: true, icon: '🧽', title: 'Water Recycler Clogged', bodies: ['mars', 'moon'], weight: 2,
    condition: (m) => (m.modules.recycler ?? 0) > 0,
    body: 'The [[eclss|water recycler]] filter is clogged with minerals. Water recovery is dropping fast.',
    science: 'On the ISS, astronauts regularly swap filters and fix the Urine Processor Assembly. Even 98%-efficient recyclers need maintenance.',
    source: 'eclss', terms: ['eclss', 'redundancy'],
    choices: [
      { label: 'Swap in a spare filter', requires: { spares: 1 }, effects: { spares: -1 }, outcome: 'Clear water flows again.' },
      { label: 'Clean it by hand (recycler down 2 sols)', effects: { disableSols: { id: 'recycler', sols: 2 } }, outcome: 'Messy, but it will work again soon.' },
    ],
  },
  {
    id: 'harvest', icon: '🥬', title: 'First Harvest!', bodies: ['mars', 'moon'], weight: 0, once: true,
    body: 'The first lettuce and radishes are ready! Fresh, crunchy food grown on another world.',
    science: 'In 2015 ISS astronauts ate the first lettuce grown in space, from NASA’s [[veggie|Veggie]] system. Fresh food gives vitamins that break down in packaged meals, and it is a huge morale boost.',
    source: 'veggie', terms: ['veggie', 'hydroponics'],
    choices: [{ label: 'Salad party!', effects: { morale: 10, science: 5 }, outcome: 'The crew agrees: the best salad of their lives.' }],
  },
  {
    id: 'lava_tube', worlds: (p) => ['basalt', 'regolith', 'lava', 'iron-oxide'].includes(p.ground), icon: '🕳️', title: 'Skylight into a Lava Tube', bodies: ['mars', 'moon'], weight: 1, once: true,
    body: 'Scouts find a deep pit, a skylight into an underground [[lava-tube|lava tube]]. Its thick rock roof could shield a future base from radiation.',
    science: 'NASA’s Lunar Reconnaissance Orbiter and Mars orbiters have photographed hundreds of pits. Meters of rock overhead would block most cosmic radiation.',
    source: 'images', terms: ['lava-tube', 'galactic-cosmic-rays'],
    choices: [
      { label: 'Survey it for a future base', effects: { science: 14 }, outcome: 'Laser scans map a tunnel 30 meters wide.' },
      { label: 'Move spare supplies inside it (better shielding)', effects: { shieldWork: 6 }, outcome: 'The tube becomes your new emergency shelter.' },
    ],
  },
  {
    id: 'aurora', icon: '🌌', title: 'Aurora on Mars', bodies: ['mars'], weight: 1, once: true,
    body: 'After a solar storm, the night sky glows with a faint green-white [[aurora]].',
    science: 'Mars has no global magnetic field, so its auroras can cover the whole sky. NASA’s MAVEN orbiter has watched them since 2014, and Perseverance captured visible aurora from the surface in 2024.',
    source: 'donki', terms: ['aurora', 'magnetosphere'],
    choices: [{ label: 'Photograph it all night', effects: { science: 8, morale: 6 }, outcome: 'One of the most beautiful nights of the mission.' }],
  },
  {
    id: 'phobos', icon: '🌘', title: 'Phobos Eclipse', bodies: ['mars'], weight: 1, once: true,
    body: 'Mars’s potato-shaped moon [[phobos|Phobos]] slides across the face of the Sun in a 40-second eclipse.',
    science: 'Perseverance filmed a Phobos eclipse in April 2022. Tracking Phobos helps scientists measure how its orbit is slowly shrinking. In about 50 million years it will break apart!',
    source: 'images', terms: ['phobos', 'eclipse'],
    choices: [{ label: 'Record it with the solar filter camera', effects: { science: 7 }, outcome: 'Data sent to the orbital dynamics team.' }],
  },
  {
    id: 'lunar_night', icon: '🌑', title: 'Lunar Night Begins', bodies: ['moon'], weight: 0,
    body: 'The Sun is setting. It will not rise again for about 14 Earth days. Temperatures will drop toward −130 °C and solar panels will produce nothing.',
    science: 'One lunar day-night cycle lasts 29.5 Earth days. Surviving the lunar night is a big reason NASA is developing [[fission-surface-power|Fission Surface Power]].',
    source: 'kilopower', terms: ['lunar-night', 'fission-surface-power', 'battery'],
    choices: [
      { label: 'Switch off non-essential systems', effects: { disable: ['greenhouse', 'rover', 'relay', 'regolithO2', 'iceDrill'] }, outcome: 'The base enters night mode.' },
      { label: 'Keep everything running', effects: {}, outcome: 'Keep an eye on that battery…' },
    ],
  },
  {
    id: 'supply_drop', icon: '📦', title: 'Cargo Lander Arrives', bodies: ['mars', 'moon'], weight: 0, once: true,
    body: 'A robotic cargo lander touched down 2 km away with fresh supplies!',
    science: 'NASA plans to send cargo ahead of crews so supplies are waiting when astronauts arrive. Some even propose landing supplies years early.',
    source: 'mars-sites', terms: ['pre-deployment', 'edl'],
    choices: [
      { label: 'Haul back food and water', effects: { food: 150, water: 200 }, outcome: 'Pantry restocked!' },
      { label: 'Haul back spare parts and oxygen', effects: { spares: 2, o2: 60 }, outcome: 'Toolbox and tanks refilled.' },
    ],
  },
  {
    id: 'medical', worlds: (p) => p.gravityG < 0.9, icon: '🩺', title: 'Sprained Wrist', bodies: ['mars', 'moon'], weight: 1, once: true,
    body: '{crewName} sprained a wrist moving heavy equipment in low gravity.',
    science: 'Low gravity changes how bodies move and slowly weakens bones and muscles. Astronauts exercise about 2 hours a day on the ISS to stay strong.',
    source: 'bvad', terms: ['bone-loss', 'low-gravity'],
    choices: [
      { label: 'Treat it properly with the medical kit', effects: { health: 2, morale: 1 }, outcome: 'Ice pack (from real ice!) and a splint.' },
      { label: 'Tape it and keep working', effects: { health: -6, science: 3 }, outcome: 'Ouch. Healing will be slower.' },
    ],
  },
  // ---- "Today's real Sun" missions only (src/live/liveMission.js). Never drawn from the random deck (weight 0). ----
  {
    id: 'sun_live_sep', icon: '☀️', title: 'Live Solar Radiation Storm!', bodies: ['mars', 'moon'], weight: 0,
    body: 'This one is real. NASA is tracking a burst of [[sep|solar energetic particles]] after a {flareClass} [[solar-flare|solar flare]]. Particles arrive within hours. Do you take cover?',
    science: 'This is a live event, not an old replay. NASA’s DONKI space weather database recorded it on {eventDate}, {liveAge}. The game read it straight from NASA when you launched.',
    source: 'donki', terms: ['sep', 'solar-flare', 'sievert', 'storm-shelter'],
    choices: [
      { label: 'Everyone into the storm shelter', requires: { module: 'shelter' }, effects: { shelter: true, morale: -2 }, outcome: 'The crew squeezes into the shelter and waits while particles slam into the walls outside.' },
      { label: 'Huddle behind the water tanks and supplies', effects: { shelter: 'partial', morale: -1 }, outcome: 'Water is great shielding. The crew camps out in the middle of the habitat, surrounded by tanks.' },
      { label: 'Keep working, the schedule matters', effects: { science: 4 }, outcome: 'Work continues… but every crew member soaks up the full dose.' },
    ],
  },
  {
    id: 'sun_live_flare', icon: '☀️', title: 'Real Solar Flare: Storm Watch', bodies: ['mars', 'moon'], weight: 0,
    body: 'The real Sun fired a {flareClass} [[solar-flare|solar flare]]. Flares this size can be followed by a burst of [[sep|solar energetic particles]], so Mission Control calls a storm watch. Do you take cover?',
    science: 'The flare is a live event: NASA’s DONKI database recorded it on {eventDate}, {liveAge}. NASA did not record a radiation storm after this flare. In the game it counts as a small storm so you can practice the shielding choice.',
    source: 'donki', terms: ['solar-flare', 'sep', 'storm-shelter', 'radiation-shielding'],
    choices: [
      { label: 'Everyone into the storm shelter', requires: { module: 'shelter' }, effects: { shelter: true, morale: -2 }, outcome: 'The crew squeezes into the shelter and waits while particles slam into the walls outside.' },
      { label: 'Huddle behind the water tanks and supplies', effects: { shelter: 'partial', morale: -1 }, outcome: 'Water is great shielding. The crew camps out in the middle of the habitat, surrounded by tanks.' },
      { label: 'Keep working, the schedule matters', effects: { science: 4 }, outcome: 'Work continues… but every crew member soaks up the full dose.' },
    ],
  },
  {
    id: 'sun_forecast', icon: '☀️', title: 'Space Weather Forecast: Storm Risk', bodies: ['mars', 'moon'], weight: 0,
    body: 'This day has not happened yet on the real calendar, so there is no recorded Sun data for it. Mission Control’s forecast says a [[sep|radiation storm]] could reach {bodyName} today. How do you get ready?',
    science: 'This is a forecast drill, not a recorded event. The chance came from what the real Sun was doing on the day you launched, read live from NASA’s DONKI database. NASA’s Moon to Mars Space Weather Analysis Office watches the Sun like this for real missions.',
    source: 'donki-live', terms: ['sep', 'storm-shelter', 'radiation-shielding', 'sievert'],
    choices: [
      { label: 'Everyone into the storm shelter', requires: { module: 'shelter' }, effects: { morale: -2 }, outcome: 'The crew waits in the shelter. In this drill a burst of particles sweeps past, and nobody picks up extra dose.' },
      { label: 'Huddle behind the water tanks and supplies', effects: { dose: 0.6, morale: -1 }, outcome: 'In this drill the storm arrives. The water tanks soak up most of it, and the crew picks up a little extra dose.' },
      { label: 'Keep working, the schedule matters', effects: { dose: 1.5, science: 4 }, outcome: 'In this drill the storm arrives while everyone is working, and every crew member soaks up the full dose.' },
    ],
  },
];

function avgMorale(m) {
  return m.crew.reduce((s, c) => s + c.morale, 0) / m.crew.length;
}

// ---- Cards for worlds other than the Moon and Mars. Kept out of EVENT_CARDS so the Moon/Mars deck is unchanged. ----
// Each card is drawn only on a world whose facts list its `hazard` (or on any world when `worlds` is true).
// The science line always says which part is measured and which part is the game's guess.
const SHELTER_CHOICES = [
  { label: 'Everyone into the storm shelter', requires: { module: 'shelter' }, effects: { shelter: true, morale: -2 }, outcome: 'The crew squeezes into the shelter and waits while particles slam into the walls outside.' },
  { label: 'Huddle behind the water tanks and supplies', effects: { shelter: 'partial', morale: -1 }, outcome: 'Water is great shielding. The crew camps out in the middle of the habitat, surrounded by tanks.' },
  { label: 'Keep working, the schedule matters', effects: { science: 4 }, outcome: 'Work continues… but every crew member soaks up the full dose.' },
];

export const WORLD_EVENT_CARDS = [
  {
    id: 'stellar_flare', icon: '🌟', title: 'Flare from {starName}!', bodies: [], hazard: 'flares', weight: 0,
    body: '{starName} just brightened in a sudden [[solar-flare|flare]]. A burst of fast particles is on its way to {bodyName}. Do you take cover?',
    science: 'Real: small red stars flare far more often than our Sun, and NASA telescopes have watched them do it. Game guess: when a flare happens in your mission and how strong it is. Nobody has measured the radiation on the ground of a planet around another star.',
    source: 'planet-fact', terms: ['solar-flare', 'sep', 'storm-shelter', 'radiation-shielding'],
    choices: SHELTER_CHOICES,
  },
  {
    id: 'long_night', icon: '🌑', title: 'Night Falls on {bodyName}', bodies: [], hazard: 'long-night', weight: 0,
    body: 'The Sun is setting. Here it stays down for about {nightDays} Earth days. Solar panels will make nothing until it rises again.',
    science: 'Real: how long a day lasts depends on how fast a world spins. A slow spin means a long night, so a base needs batteries or [[fission-surface-power|nuclear power]] to get through it.',
    source: 'planet-fact', terms: ['fission-surface-power', 'battery', 'solar-array'],
    choices: [
      { label: 'Switch off the extras (greenhouse, rover, relay)', effects: { disable: ['greenhouse', 'rover', 'relay'] }, outcome: 'The base enters night mode. Life support keeps running.' },
      { label: 'Keep everything running', effects: {}, outcome: 'Keep an eye on that battery…' },
    ],
  },
  {
    id: 'world_dust_storm', icon: '🌪️', title: 'Dust Storm Rolling In', bodies: [], hazard: 'dust-storms', weight: 0,
    body: 'A wall of dust is heading for the base. The sky will darken and the [[tau|dust opacity]] will climb. Solar panels will make much less power.',
    science: 'Real: any world with air and loose dust can raise [[dust-storm|dust storms]]. On Mars they have been measured for decades. Game guess: how big and how long a storm is on {bodyName}.',
    source: 'planet-fact', terms: ['dust-storm', 'tau', 'solar-array'],
    choices: [
      { label: 'Fill the batteries now and ride it out', effects: { storm: { tau: 3, sols: 6 }, battery: 40 }, outcome: 'The crew tops off the batteries while the light lasts.' },
      { label: 'Switch off the greenhouse lights to save power', effects: { storm: { tau: 3, sols: 6 }, disable: 'greenhouse' }, outcome: 'The plants will be dark for a while, but life support is safe.' },
    ],
  },
  {
    id: 'volcano_plume', icon: '🌋', title: 'A Volcano Erupts!', bodies: [], hazard: 'volcanism', weight: 3,
    body: 'A volcano beyond the horizon is throwing a plume high into the sky. Fine ash and sulfur frost will rain down on the base.',
    science: 'Real: Jupiter’s moon Io is the most volcanic world we know. Voyager 1 saw its plumes in 1979, and some rise more than 300 km. Game guess: how much ash lands on your base.',
    source: 'planet-fact', terms: ['solar-array', 'spectrometer'],
    choices: [
      { label: 'Cover the machines and wait', effects: { dust: 0.05, morale: -1 }, outcome: 'Covers on. A thin yellow frost settles over everything.' },
      { label: 'Point every instrument at the plume', effects: { science: 14, dust: 0.2, breakChance: 0.3 }, outcome: 'Amazing data, but ash got into everything.' },
    ],
  },
  {
    id: 'tidal_quake', icon: '📳', title: 'The Ground Shakes!', bodies: [], hazard: 'tidal-quakes', weight: 3, once: true,
    body: 'The habitat shakes. The pull of the giant world nearby stretches and squeezes the ground here, and it just cracked.',
    science: 'Real: tides from a giant planet flex its moons, which heats their insides and cracks their crust. Game guess: nobody has put a [[seismometer]] here yet, so how strong the quakes are is not known.',
    source: 'planet-fact', terms: ['seismometer', 'redundancy'],
    choices: [
      { label: 'Inspect every system (one crew-sol of work)', effects: { repairAll: true, science: 4 }, outcome: 'All clear, and the shaking data is gold for scientists.' },
      { label: 'Seems fine, keep going', effects: { breakChance: 0.5 }, outcome: 'Hopefully nothing was damaged…' },
    ],
  },
  {
    id: 'heat_wave', icon: '🥵', title: 'Chillers Working Overtime', bodies: [], hazard: 'extreme-heat', weight: 3,
    body: 'The ground outside is hot enough to bake bread. The chillers that keep the [[habitat]] cool are running flat out and one is starting to struggle.',
    science: 'Real: getting rid of heat is one of the hardest jobs for a spacecraft on a hot world. The Soviet Venera landers lasted about two hours on Venus before the heat stopped them. Game guess: how a crewed base would cope.',
    source: 'planet-fact', terms: ['habitat', 'kwh', 'redundancy'],
    choices: [
      { label: 'Swap in a spare pump', requires: { spares: 1 }, effects: { spares: -1 }, outcome: 'Cool air flows again.' },
      { label: 'Switch off extras to ease the load', effects: { disable: ['greenhouse', 'rover', 'relay'], morale: -1 }, outcome: 'Less heat inside means less heat to pump out.' },
      { label: 'Push the chillers harder (drains 40 kWh)', effects: { battery: -40, breakChance: 0.3 }, outcome: 'It works, for now.' },
    ],
  },
  {
    id: 'acid_haze', icon: '🧪', title: 'Acid Haze', bodies: [], hazard: 'acid-clouds', weight: 3,
    body: 'Sensors on the hull show acid eating at the seals and joints outside.',
    science: 'Real: the clouds of Venus are made of sulfuric acid, 48 to 70 km above the ground. The acid rain there boils away long before it lands. Game guess: acid mist reaching machines on the ground.',
    source: 'planet-fact', terms: ['atmospheric-pressure', 'redundancy'],
    choices: [
      { label: 'Replace the worn seals with spare parts', requires: { spares: 1 }, effects: { spares: -1 }, outcome: 'Fresh seals, good as new.' },
      { label: 'Leave it and watch closely', effects: { breakChance: 0.6, science: 3 }, outcome: 'You learn how fast acid works. Maybe too fast.' },
    ],
  },
  {
    id: 'methane_rain', icon: '🌧️', title: 'Methane Rain', bodies: [], hazard: 'methane-rain', weight: 3, once: true,
    body: 'Big, slow drops are falling outside. It is not water. It is liquid methane, the same stuff as cooking gas, and it is far colder than any freezer.',
    science: 'Real: on Saturn’s moon Titan methane rains from the sky and fills lakes and seas. NASA’s Cassini saw the ground darken after rainstorms, and the Huygens probe landed on damp ground in 2005. Methane is not water, so the crew cannot drink it.',
    source: 'planet-fact', terms: ['atmospheric-pressure', 'spectrometer'],
    choices: [
      { label: 'Catch some in a sample jar', effects: { science: 14, morale: 3 }, outcome: 'A jar of alien rain. The lab is thrilled.' },
      { label: 'Stay in and watch through the window', effects: { morale: 5, science: 3 }, outcome: 'Rain on another world. Nobody says a word.' },
    ],
  },
  {
    id: 'ice_plume', icon: '⛲', title: 'An Ice Geyser Erupts', bodies: [], hazard: 'cryovolcanism', weight: 3, once: true,
    body: 'A crack in the ground is spraying a fountain of [[water-ice|ice grains]] far up into the black sky. Fresh snow is drifting down near the base.',
    science: 'Real: in 2005 NASA’s Cassini found geysers of water ice shooting from Saturn’s moon Enceladus, fed by a salty ocean under the ice. Game guess: one erupting close enough to your base to collect.',
    source: 'planet-fact', terms: ['water-ice', 'isru'],
    choices: [
      { label: 'Scoop up the fresh snow (+80 kg water)', effects: { water: 80, science: 4 }, outcome: 'Free water, straight from a hidden ocean.' },
      { label: 'Test the snow for signs of life', effects: { science: 18, morale: 3 }, outcome: 'Salt and carbon molecules. The whole science team on Earth wants this data.' },
    ],
  },
  {
    id: 'belt_surge', icon: '☢️', title: 'Radiation Belt Surge', bodies: [], hazard: 'radiation-belts', weight: 3,
    body: 'The [[radiation]] counters are climbing. The giant planet’s [[magnetosphere|magnetic field]] is sweeping an extra-thick cloud of trapped particles over the base.',
    science: 'Real: giant planets trap fast particles in belts around them, and NASA’s Galileo and Juno probes measured how fierce Jupiter’s are. Game guess: when a surge passes over your base.',
    source: 'planet-fact', terms: ['radiation', 'magnetosphere', 'radiation-shielding'],
    choices: [
      { label: 'Everyone to the middle of the habitat', effects: { dose: 1, morale: -1 }, outcome: 'The walls and water tanks soak up most of it.' },
      { label: 'Keep working, the schedule matters', effects: { dose: 12, science: 4 }, outcome: 'Work continues… and every badge ticks upward.' },
    ],
  },
  {
    id: 'far_from_home', icon: '📡', title: 'A Long Way from Home', bodies: [], worlds: true, weight: 2, once: true,
    body: 'The crew is thinking about home. A radio message from {bodyName} takes {homeDelay} to reach Earth, so nobody can chat live.',
    science: 'Real: radio travels at the speed of light and nothing goes faster. The [[light-delay|light delay]] comes straight from how far away {bodyName} is.',
    source: 'planet-fact', terms: ['light-delay', 'behavioral-health'],
    choices: [
      { label: 'Record video letters for Earth', effects: { morale: 8 }, outcome: 'Everyone has something to say to the people back home.' },
      { label: 'Give everyone an extra rest sol', effects: { morale: 6, health: 3, science: -3 }, outcome: 'A lazy sol with books and music.' },
    ],
  },
];

export const eventById = (id) => EVENT_CARDS.find((e) => e.id === id) ?? WORLD_EVENT_CARDS.find((e) => e.id === id) ?? null;


// Plain-language event text for Cadet view (ages 7 to 12). Presentation only: the cards, their effects and
// their numbers live in eventCards.js and are never changed here. Each entry retells one card in a short
// title and ONE sentence, and gives every choice a short label, in the same order as the card's choices.
// {crewName}, {bodyName}, {flareClass} and {eventDate} are filled in by the engine's fillTemplate.
export const KID_EVENTS = {
  sep_alert: {
    title: 'Solar storm!',
    line: 'The Sun just threw out a burst of radiation, and it will reach your base in a few hours.',
    choices: ['Hide in the storm shelter', 'Hide behind the water tanks', 'Keep working'],
  },
  // Live-data cards (added to eventCards.js by the live NASA data work). Same three choices as sep_alert.
  sun_live_sep: {
    title: 'Real solar storm',
    line: 'This one is real: NASA is tracking a burst of radiation from the Sun right now, and it arrives in a few hours.',
    choices: ['Hide in the storm shelter', 'Hide behind the water tanks', 'Keep working'],
  },
  sun_live_flare: {
    title: 'Real solar flare: storm watch',
    line: 'The real Sun just fired a big flash, and flashes this size can be followed by a radiation storm.',
    choices: ['Hide in the storm shelter', 'Hide behind the water tanks', 'Keep working'],
  },
  sun_forecast: {
    title: 'Space weather forecast: storm risk',
    line: 'Mission Control says a radiation storm could reach {bodyName} today, so this is a practice drill.',
    choices: ['Hide in the storm shelter', 'Hide behind the water tanks', 'Keep working'],
  },
  dust_storm: {
    title: 'A dust storm is coming',
    line: 'Dust will darken the sky, so your solar panels will make much less power.',
    choices: ['Switch off the greenhouse lights', 'Fill the batteries now', 'Go outside and clean the panels'],
  },
  global_storm: {
    title: 'A giant dust storm',
    line: 'Dust is wrapping around the whole planet, and solar power will almost stop for weeks.',
    choices: ['Switch off everything except life support', 'Keep everything running'],
  },
  dust_devil: {
    title: 'A dust devil cleaned the panels!',
    line: 'A spinning wind blew most of the dust off your solar panels.',
    choices: ['Lucky us!'],
  },
  perchlorate: {
    title: 'Bad salt in the soil',
    line: 'The soil here has a salt that is bad for people and plants, and the greenhouse was about to use it.',
    choices: ['Wash the soil (uses 120 kg of water)', 'Grow the plants in water (uses more power)', 'Use the soil anyway'],
  },
  ice_found: {
    title: 'Ice under the ground!',
    line: 'Radar found a thick layer of water ice close to your base.',
    choices: ['Map it for the ice drill (drill makes 50% more)', 'Study it to learn about old weather'],
  },
  meteorite: {
    title: 'A strange shiny rock',
    line: 'Your explorers spotted a dark, shiny rock that may have fallen from space.',
    choices: ['Test it with the rock scanner', 'Write down where it is and move on'],
  },
  micrometeoroid: {
    title: 'A tiny space rock hit the base!',
    line: 'A rock smaller than a grain of sand made a small hole, and air is slowly leaking out.',
    choices: ['Patch it with a spare kit', 'Go outside and patch it with tape and foam'],
  },
  moonquake: {
    title: 'Moonquake!',
    line: 'The ground shook for almost ten minutes, but the base is still standing.',
    choices: ['Check every machine', 'It seems fine, keep going'],
  },
  conjunction: {
    title: 'No radio to Earth',
    line: 'The Sun is moving between Earth and Mars, so you cannot talk to Mission Control for about two weeks.',
    choices: ['Record video diaries to send later', 'Plan crew movie nights'],
  },
  birthday: {
    title: 'A birthday on {bodyName}!',
    line: '{crewName} has a birthday today, and the crew wants to celebrate.',
    choices: ['Bake a cake (uses 5 kg of food)', 'Sing and send a video home'],
  },
  homesick: {
    title: 'Missing home',
    line: 'The crew misses home, and every message to Earth takes minutes to arrive.',
    choices: ['Swap video letters with home', 'Give everyone an extra rest day'],
  },
  blue_sunset: {
    title: 'A blue sunset',
    line: 'The crew gathers at the window because the sunset on Mars is blue.',
    choices: ['Take photos for Earth'],
  },
  earthrise: {
    title: 'Earth in the sky',
    line: 'From the window, the crew can see Earth, blue and white, above the Moon.',
    choices: ['Call home and wave'],
  },
  frost: {
    title: 'Morning frost',
    line: 'The crew woke up to a thin white layer of frost on the ground outside.',
    choices: ['Collect some'],
  },
  rover_stuck: {
    title: 'The rover is stuck!',
    line: 'The rover sank into soft sand up to its wheels.',
    choices: ['Go outside and dig it out', 'Leave it for now (no rover for 6 days)'],
  },
  filter_clog: {
    title: 'The water cleaner is clogged',
    line: 'The filter in the water recycler is blocked, so it is cleaning less water.',
    choices: ['Put in a spare filter', 'Clean it by hand (no recycler for 2 days)'],
  },
  harvest: {
    title: 'First harvest!',
    line: 'The first lettuce and radishes are ready to eat, grown on another world.',
    choices: ['Salad party!'],
  },
  lava_tube: {
    title: 'A cave under the ground',
    line: 'Scouts found a deep hole into a cave with a thick rock roof that blocks radiation.',
    choices: ['Map it for a future base', 'Move spare supplies inside for a better shield'],
  },
  aurora: {
    title: 'Glowing lights in the sky',
    line: 'After a solar storm, the night sky is glowing soft green and white.',
    choices: ['Take photos all night'],
  },
  phobos: {
    title: 'A moon crosses the Sun',
    line: 'The little Mars moon Phobos slides across the Sun for 40 seconds.',
    choices: ['Film it with the Sun camera'],
  },
  lunar_night: {
    title: 'Night on the Moon begins',
    line: 'The Sun is setting for about 14 Earth days, so it will get very cold and solar panels will make no power.',
    choices: ['Switch off the extra machines', 'Keep everything running'],
  },
  supply_drop: {
    title: 'A cargo lander has arrived!',
    line: 'A robot lander touched down 2 km away with fresh supplies.',
    choices: ['Bring back food and water', 'Bring back spare kits and air'],
  },
  medical: {
    title: 'A hurt wrist',
    line: '{crewName} hurt a wrist while moving heavy gear in low gravity.',
    choices: ['Treat it with the medical kit', 'Tape it and keep working'],
  },
  // Cards for worlds beyond the Moon and Mars (WORLD_EVENT_CARDS in eventCards.js). Same choice order as each card.
  stellar_flare: {
    title: 'Your star flared!',
    line: 'Your star just flashed bright, and a burst of radiation is heading for your base.',
    choices: ['Hide in the storm shelter', 'Hide behind the water tanks', 'Keep working'],
  },
  long_night: {
    title: 'A long night begins',
    line: 'The Sun is setting and will stay down for many days, so the solar panels will make nothing.',
    choices: ['Switch off the extra machines', 'Keep everything running'],
  },
  world_dust_storm: {
    title: 'Dust storm coming',
    line: 'A wall of dust is rolling in, and it will block sunlight from the solar panels.',
    choices: ['Fill the batteries now', 'Turn off the greenhouse lights'],
  },
  volcano_plume: {
    title: 'A volcano erupts!',
    line: 'A volcano nearby is shooting gas and dust high into the sky.',
    choices: ['Cover the machines and wait', 'Point every science tool at it'],
  },
  tidal_quake: {
    title: 'The ground shakes!',
    line: 'The pull of a giant planet squeezes this world, and the ground just shook.',
    choices: ['Check every machine (takes a day of work)', 'Looks fine, keep going'],
  },
  heat_wave: {
    title: 'Too hot outside',
    line: 'It is so hot outside that the coolers can barely keep the base cool.',
    choices: ['Fit a spare pump', 'Turn off extra machines', 'Run the coolers harder (uses lots of power)'],
  },
  acid_haze: {
    title: 'Acid in the air',
    line: 'The air here has acid in it, and it is eating at the base’s rubber seals.',
    choices: ['Fix the seals with spare parts', 'Leave it and keep watching'],
  },
  methane_rain: {
    title: 'Methane rain',
    line: 'It is raining outside, but the rain is freezing cold liquid methane, not water.',
    choices: ['Catch some in a jar', 'Watch through the window'],
  },
  ice_plume: {
    title: 'An ice geyser!',
    line: 'A crack in the ground is spraying ice high into the sky, and fresh snow is falling nearby.',
    choices: ['Scoop up the snow (80 kg of water)', 'Test the snow for signs of life'],
  },
  belt_surge: {
    title: 'Radiation surge',
    line: 'The giant planet’s radiation belts just got stronger, so the crew should get to the safest spot.',
    choices: ['Everyone to the middle of the base', 'Keep working'],
  },
  far_from_home: {
    title: 'Far from home',
    line: 'Earth is so far away that the crew is starting to miss home.',
    choices: ['Record video letters for Earth', 'Give everyone an extra rest day'],
  },
};

export const kidEvent = (cardId) => KID_EVENTS[cardId] ?? null;

// Picture for each card (an icon name from src/ui/icons.js).
export const KID_EVENT_ICONS = {
  sep_alert: 'sun', sun_live_sep: 'sun', sun_live_flare: 'sun', sun_forecast: 'sun', dust_storm: 'wind', global_storm: 'wind', dust_devil: 'wind', perchlorate: 'alert', ice_found: 'snowflake',
  meteorite: 'mountain', micrometeoroid: 'alert', moonquake: 'alert', conjunction: 'antenna', birthday: 'star', homesick: 'user',
  blue_sunset: 'sun', earthrise: 'orbit', frost: 'snowflake', rover_stuck: 'rover', filter_clog: 'recycle', harvest: 'sprout',
  lava_tube: 'mountain', aurora: 'star', phobos: 'moon', lunar_night: 'moon', supply_drop: 'package', medical: 'user',
  stellar_flare: 'sun', long_night: 'moon', world_dust_storm: 'wind', volcano_plume: 'mountain', tidal_quake: 'alert', heat_wave: 'thermometer',
  acid_haze: 'flask', methane_rain: 'droplet', ice_plume: 'snowflake', belt_surge: 'atom', far_from_home: 'orbit',
};

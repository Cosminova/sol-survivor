// Educator lessons: one per campaign chapter plus standalone activities. terms are glossary ids; ngss are
// official NGSS performance expectation codes (see ngss.js). Written for grades 4–9, 30–50 minute class periods.
import { NGSS_STANDARDS } from './ngss.js';

export const LESSONS = [
  {
    id: 'lesson-life-support', missionId: 'artemis-dawn', title: 'Breathe, Drink, Eat: Life Support Basics',
    gradeBand: '4–7', minutes: 45, ngss: ['3-5-ETS1-1', 'MS-ETS1-1', 'MS-LS1-3'],
    objectives: [
      'Calculate how much oxygen, water and food a crew needs using NASA’s real per-person numbers.',
      'Explain why every kilogram matters when packing a lander (mass budget).',
      'Compare carrying supplies with recycling them.',
    ],
    terms: ['life-support', 'bvad', 'eclss', 'payload', 'trade-off', 'psr'],
    warmUp: 'List everything your body needs to stay alive for one day. Circle the things a spacecraft would have to carry.',
    steps: [
      'Show the NASA numbers: 0.82 kg oxygen, 3.5 kg water, 1.8 kg food per astronaut per day.',
      'In pairs, calculate the supplies for 4 astronauts for 14 days. (Oxygen ≈ 46 kg, water = 196 kg, food ≈ 101 kg.)',
      'Play Chapter 1, “Artemis Dawn”. Before launching, compare your numbers with the game’s packing warnings.',
      'After the mission, read the debrief together. Which supplies ran low? Which machine saved the most mass?',
      'Introduce the ISS water recycler (98% recovery) and recalculate the water needed with a recycler.',
    ],
    discussion: [
      'Why does NASA not just pack extra of everything?',
      'What would happen on a 600-day Mars mission without recycling?',
      'What is one trade-off you made while packing?',
    ],
    extension: 'Weigh one day of your own food and water at home. Multiply by 4 crew and 30 days. Could it fit in your classroom?',
    exitTicket: 'One astronaut needs 0.82 kg of oxygen per day. How much do 4 astronauts need for 10 days? (32.8 kg)',
  },
  {
    id: 'lesson-lunar-night', missionId: 'long-night', title: 'Keeping the Lights On: Power Through the Lunar Night',
    gradeBand: '4–7', minutes: 45, ngss: ['4-PS3-2', '4-PS3-4', 'MS-ESS1-1', 'MS-PS3-3'],
    objectives: [
      'Explain why most places on the Moon have 14 days of light and 14 days of darkness.',
      'Compare solar panels, batteries and fission power for a lunar base.',
      'Use kilowatts and kilowatt-hours to plan an energy budget.',
    ],
    terms: ['lunar-day', 'lunar-night', 'tidal-locking', 'solar-array', 'battery', 'kwh', 'fission-surface-power'],
    warmUp: 'If the Sun set and did not rise again for two weeks, what at home would stop working?',
    steps: [
      'Model the lunar day with a lamp (Sun) and a ball (Moon) that always shows one face to a globe (Earth).',
      'Teach energy = power × time. A 3 kW habitat needs 72 kWh per Earth day, about 1,000 kWh for a 14-day night.',
      'One 100 kWh battery bank weighs 700 kg in the game. How many would the night need? What would they weigh?',
      'Play Chapter 2, “The Long Night”, choosing either batteries only or a fission unit. Compare results across the room.',
      'Graph the battery level over the mission from the in-game chart.',
    ],
    discussion: [
      'Why is NASA developing Fission Surface Power for the Moon?',
      'Why did the Apollo crews never have to survive a lunar night?',
      'Which choice was heavier, and which was riskier?',
    ],
    extension: 'Research why Artemis is targeting the lunar south pole, where some ridges are sunlit most of the time.',
    exitTicket: 'A 2 kW heater runs for 5 hours. How many kWh does it use? (10 kWh)',
  },
  {
    id: 'lesson-dust-storms', missionId: 'red-dust', title: 'Dust Storms and Solar Power on Mars',
    gradeBand: '5–8', minutes: 45, ngss: ['MS-ESS1-1', 'MS-ESS3-2', '4-ESS3-1', 'MS-ETS1-3'],
    objectives: [
      'Describe what dust opacity (tau) measures and how it changes solar power.',
      'Connect Mars’s seasons (Ls) and perihelion to dust storm season.',
      'Use the story of Opportunity to evaluate solar versus nuclear power.',
    ],
    terms: ['dust-storm', 'tau', 'solar-longitude', 'perihelion', 'solar-array', 'dust-devil', 'rtg'],
    warmUp: 'Shine a flashlight at a paper “solar panel” through clear plastic, then through plastic dusted with flour. What changes?',
    steps: [
      'Explain tau: 0.5 is a clear day, 3 is a big storm, about 10.8 was the 2018 global storm.',
      'Show why storms are common near perihelion (Ls 251°): Mars gets about 45% more sunlight than at aphelion.',
      'Play Chapter 3, “Red Dust Rising”. Record solar output before, during and after the scripted storm.',
      'Tell the story of Opportunity (solar) and Curiosity (nuclear RTG) during the 2018 storm.',
      'Teams propose a power plan for a 500-sol mission and defend it to the class.',
    ],
    discussion: [
      'How did dust devils help Spirit and Opportunity?',
      'Why might future crews still use solar panels even though storms happen?',
      'What is the trade-off between solar panels and a fission reactor?',
    ],
    extension: 'Find the 2018 global dust storm in the REMS pressure and opacity data in the Data Lab.',
    exitTicket: 'Name one reason Curiosity survived the 2018 dust storm when Opportunity did not.',
  },
  {
    id: 'lesson-space-weather', missionId: 'solar-storm', title: 'Space Weather: Shielding Your Crew',
    gradeBand: '5–9', minutes: 50, ngss: ['MS-ESS3-2', 'MS-PS4-2', 'MS-ETS1-2'],
    objectives: [
      'Distinguish galactic cosmic rays from solar energetic particles.',
      'Use real DONKI data to describe the May 2024 solar storms.',
      'Compare radiation doses using millisieverts and everyday examples.',
    ],
    terms: ['radiation', 'galactic-cosmic-rays', 'sep', 'solar-flare', 'cme', 'sievert', 'storm-shelter', 'radiation-shielding', 'donki', 'rad'],
    warmUp: 'Rank from smallest to largest radiation dose: a chest X-ray, a CT scan, six months on the ISS, a trip to Mars.',
    steps: [
      'Show NASA’s RAD comparison chart (PIA17601): CT scan ≈ 8 mSv, ISS 6 months ≈ 75 mSv, Mars trip ≈ 330 mSv.',
      'Open the Data Lab’s DONKI chart and count the X-class flares in May 2024 (21).',
      'Play Chapter 4, “Solar Maximum”, which replays the real storms of May 2024 sol by sol.',
      'Record each crew member’s dose. Compare sheltered and unsheltered choices across the class.',
      'Discuss why water and regolith are good shields (lots of hydrogen and mass), and why lead is not ideal.',
    ],
    discussion: [
      'Solar particles can be blocked by a shelter, but cosmic rays are much harder. Why?',
      'Why does Earth’s magnetic field matter so much to life on Earth?',
      'How could forecasters on Earth help a crew on Mars when messages take up to 22 minutes?',
    ],
    extension: 'Design a storm shelter for a Mars habitat using only things a crew already carries (water, food, supplies).',
    exitTicket: 'Which is easier to shield against, solar particles or galactic cosmic rays? Explain in one sentence.',
  },
  {
    id: 'lesson-living-off-land', missionId: 'green-thumb', title: 'Living off the Land: Greenhouses and Ice',
    gradeBand: '5–8', minutes: 50, ngss: ['5-LS1-1', '5-LS2-1', 'MS-LS1-6', 'MS-LS2-3', 'MS-ESS3-1', 'MS-PS1-2'],
    objectives: [
      'Explain how plants make food and oxygen from carbon dioxide, water and light.',
      'Describe how ISRU (ice mining, MOXIE) reduces what must be launched from Earth.',
      'Model a closed-loop life support system.',
    ],
    terms: ['isru', 'water-ice', 'moxie', 'electrolysis', 'hydroponics', 'veggie', 'perchlorate', 'closed-loop'],
    warmUp: 'Draw arrows: what does a person give a plant, and what does a plant give back?',
    steps: [
      'Build a class diagram of a closed loop: crew → CO₂ → plants → O₂ and food → crew; water → recycler → crew.',
      'Introduce real ISRU: MOXIE made 122 g of oxygen from Mars air; buried ice exists at sites like Arcadia Planitia.',
      'Play Chapter 5, “Green Thumb”. Note when the first harvest arrives (about 25 sols) and how much water the drill mines.',
      'Explain perchlorate (found by Phoenix in 2008) and why Mars soil must be washed before farming.',
      'Calculate how many kilograms of food did not have to be launched thanks to the greenhouse.',
    ],
    discussion: [
      'Why does it matter where on Mars you land if you want to mine ice?',
      'What would happen to the loop if the plants died?',
      'Is electrolysis (splitting water) a chemical reaction? How do you know?',
    ],
    extension: 'Grow fast plants (radish or lettuce) under different light levels and log the results like a Veggie scientist.',
    exitTicket: 'Name two things a Mars greenhouse produces and one thing it needs.',
  },
  {
    id: 'lesson-long-haul', missionId: 'long-haul', title: 'The Long Haul: Balancing Every System',
    gradeBand: '6–9', minutes: 50, ngss: ['MS-ETS1-1', 'MS-ETS1-2', 'MS-ETS1-4', '3-5-ETS1-2'],
    objectives: [
      'Plan a full 150-sol Mars surface mission under a mass budget.',
      'Use the game as a model to test, compare and improve designs.',
      'Explain how light delay and solar conjunction force crews to be independent.',
    ],
    terms: ['trade-off', 'redundancy', 'pre-deployment', 'light-delay', 'solar-conjunction', 'dose-limit', 'behavioral-health'],
    warmUp: 'You can send one message to Earth and wait 40 minutes for a reply. What do you ask, and what do you solve yourself?',
    steps: [
      'Teams write design criteria (crew survives, science goal, dose under limit) and constraints (mass budget).',
      'Each team plays Chapter 6, “The Long Haul”, with the same mission code so results are a fair test.',
      'Collect each team’s points, stars, dose and resources into a class table.',
      'Teams combine the best ideas from others into a version 2 loadout and replay.',
      'Present: what changed between version 1 and version 2, and what did the data show?',
    ],
    discussion: [
      'What is redundancy, and where did it save your mission?',
      'Why is pre-deploying cargo before the crew arrives a good idea?',
      'How did crew morale and rest affect the mission?',
    ],
    extension: 'Write a one-page mission proposal to NASA, using numbers from your best run as evidence.',
    exitTicket: 'Describe one trade-off you made and the evidence that it was a good choice.',
  },
  {
    id: 'lesson-habitat-design', title: 'Design a Habitat on Paper',
    gradeBand: '4–8', minutes: 45, ngss: ['3-5-ETS1-1', '3-5-ETS1-2', '3-5-ETS1-3', 'MS-ETS1-1', 'MS-ETS1-2', 'MS-PS3-3'],
    objectives: [
      'Identify the hazards a Moon or Mars habitat must protect against.',
      'Sketch and label a habitat that meets criteria within a mass budget.',
      'Peer-review designs against the same criteria.',
    ],
    terms: ['habitat', 'airlock', 'radiation-shielding', 'regolith', 'lava-tube', 'micrometeoroid', 'atmospheric-pressure'],
    warmUp: 'List five ways the Moon or Mars could hurt an astronaut. (Cold, thin air, radiation, dust, meteoroids…)',
    steps: [
      'Give each team a budget of 20 “mass points”. Airlock 2, greenhouse 4, storm shelter 3, solar array 1, and so on.',
      'Teams pick a site from the game map (Shackleton, Jezero, Arcadia…) and note its hazards.',
      'Sketch a floor plan. Label how it handles air pressure, temperature, radiation and dust.',
      'Gallery walk: teams leave sticky-note feedback using the criteria.',
      'Test the design in Free Play with a matching loadout. Where did it fail first? Fix that one weakness and test again.',
    ],
    discussion: [
      'Why might future crews bury habitats under regolith or build inside lava tubes?',
      'What did another team do better than yours?',
      'Which hazard was hardest to design for?',
    ],
    extension: 'Build a 3D model from recycled materials and test how well it insulates an ice cube for 30 minutes.',
    exitTicket: 'Name two hazards and the habitat feature that protects against each.',
  },
  {
    id: 'lesson-mars-weather', title: 'Read Real Mars Weather',
    gradeBand: '5–8', minutes: 40, ngss: ['5-ESS1-2', 'MS-ESS1-1', 'MS-ESS2-5'],
    objectives: [
      'Read and interpret a graph of real Curiosity REMS temperature and pressure data.',
      'Find extremes (coldest night, highest pressure) and patterns across a Mars year.',
      'Explain why pressure on Mars rises and falls with the seasons.',
    ],
    terms: ['rems', 'sol', 'solar-longitude', 'atmospheric-pressure', 'carbon-dioxide', 'mars-year'],
    warmUp: 'What is the coldest temperature you have ever felt? Predict the coldest night Curiosity has measured.',
    steps: [
      'Open the Data Lab REMS chart (more than 4,700 sols from 2012 to 2026).',
      'Find the coldest night in the data: −100 °C on 25 June 2020 (sol 2,803). Compare with Earth’s record, −89.2 °C.',
      'Trace one Mars year (668 sols). When is pressure highest and lowest? (About 680 to 925 Pa.)',
      'Explain: in each pole’s winter, carbon dioxide freezes onto the ice cap, so the whole atmosphere thins.',
      'Compare Gale Crater’s day–night temperature swing with your town’s.',
    ],
    discussion: [
      'Why is Mars’s day–night temperature swing so much bigger than Earth’s?',
      'Why do scientists use Ls instead of months to describe Mars’s seasons?',
      'What other measurements would you want a Mars weather station to record?',
    ],
    extension: 'Record your local high, low and pressure for a week and graph it next to Curiosity’s.',
    exitTicket: 'From the graph, give the sol and temperature of one cold night and explain why Mars nights are so cold.',
  },
  {
    id: 'lesson-radiation', title: 'Radiation and Shielding',
    gradeBand: '6–9', minutes: 45, ngss: ['MS-PS4-2', 'MS-ESS3-2', 'MS-ETS1-3'],
    objectives: [
      'Order everyday and space radiation doses on a logarithmic ladder.',
      'Explain why hydrogen-rich materials make good shields.',
      'Evaluate shielding choices using dose data from the game.',
    ],
    terms: ['radiation', 'sievert', 'gray', 'galactic-cosmic-rays', 'sep', 'magnetosphere', 'water-wall', 'dose-limit'],
    warmUp: 'Do you think a trip to Mars gives more radiation than a CT scan? How much more?',
    steps: [
      'Build the dose ladder from NASA data: chest X-ray 0.1, US yearly average 3.6, CT 8, ISS six months 75, Mars trip 330, career limit 600 mSv.',
      'Discuss why each step on a log scale is 10 times bigger than the last.',
      'Demonstrate shielding with a flashlight and layers of paper (light is a model; real particles behave differently).',
      'In the game, run one Mars sol with all crew on EVA, then one with everyone inside behind 2 shield levels. Compare doses.',
      'Use the debrief’s “chest X-ray” comparison to explain each crew member’s total dose.',
    ],
    discussion: [
      'Why does NASA set a career dose limit instead of a per-mission limit?',
      'Why are water tanks a smart shield on a spacecraft?',
      'Is all radiation dangerous? (Sunlight and radio waves are radiation too.)',
    ],
    extension: 'Read NASA’s “Why Space Radiation Matters” and write three questions you would ask a NASA radiation scientist.',
    exitTicket: 'A Mars sol gives 0.64 mSv. About how many chest X-rays is that? (About 6.)',
  },
  {
    id: 'lesson-compare-worlds', title: 'Earth, Moon, Mars: Compare the Worlds',
    gradeBand: '4–8', minutes: 40, ngss: ['5-PS2-1', 'MS-ESS1-2', 'MS-ESS1-3'],
    objectives: [
      'Use the NASA Planetary Fact Sheet to compare gravity, day length, temperature and air.',
      'Calculate your weight on the Moon and Mars.',
      'Decide which world is harder to live on, and defend it with data.',
    ],
    terms: ['gravity', 'low-gravity', 'sol', 'lunar-day', 'atmospheric-pressure', 'magnetosphere', 'orbit'],
    warmUp: 'Guess: on which world would you weigh the least, the Moon or Mars?',
    steps: [
      'Open the comparison table in the Data Lab (values from NASA’s Planetary Fact Sheet).',
      'Calculate your weight on Mars (× 0.38) and the Moon (× 0.165).',
      'In groups, each pick one row (temperature, air, radiation…) and explain what it means for astronauts.',
      'Hold a class debate: is the Moon or Mars the better first home? Use at least three numbers.',
    ],
    discussion: [
      'Why does the Moon have almost no air but Mars has a thin atmosphere?',
      'Which number surprised you the most?',
      'What does the Moon teach us that helps on Mars?',
    ],
    extension: 'Add Venus or a moon of Jupiter to the table from the NASA Planetary Fact Sheet and compare.',
    exitTicket: 'Write your weight on Mars and show the calculation.',
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id) ?? null;
export const lessonForMission = (missionId) => LESSONS.find((l) => l.missionId === missionId) ?? null;

// Standards coverage: one row per NGSS code used, with the lessons that address it.
export const NGSS_ALIGNMENT = Object.entries(NGSS_STANDARDS)
  .map(([code, s]) => ({ code, grade: s.grade, title: s.title, lessons: LESSONS.filter((l) => l.ngss.includes(code)).map((l) => l.id) }))
  .filter((row) => row.lessons.length > 0);

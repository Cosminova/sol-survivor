// Story campaign. Each chapter teaches one big trade-off, then the next adds another.
// Start dates fall inside the bundled DONKI range (2024–2025) so real solar storms replay.
export const DIFFICULTY = {
  cadet: { label: 'Cadet', failRate: 0.002, eventRate: 0.1, budgetMultiplier: 1.15 },
  specialist: { label: 'Specialist', failRate: 0.004, eventRate: 0.14, budgetMultiplier: 1 },
  commander: { label: 'Commander', failRate: 0.007, eventRate: 0.18, budgetMultiplier: 0.9 },
};

export const CAMPAIGN = [
  {
    id: 'artemis-dawn', chapter: 1, title: 'Artemis Dawn', body: 'moon', siteId: 'shackleton',
    targetSols: 14, budgetKg: 4300, scienceGoal: 150, startDate: '2024-03-01', phaseOffsetDays: 0,
    lesson: 'Life support basics: oxygen, water and food.',
    teaser: 'Four astronauts. Fourteen days. Everything they need must fit on one lander.',
    intro: 'Welcome to the lunar south pole, Cadet. Here the Sun skims the horizon and shadows stretch for kilometers, while the craters below have not seen daylight in billions of years. Your job: keep four astronauts breathing, drinking and fed for 14 days while they explore. Every kilogram rode a rocket to get here. Pack wisely.',
    win: 'Fourteen days on the Moon and every astronaut is healthy. Tonight, somewhere on Earth, a kid looks up at the Moon and knows people are living there. Next: survive the dark.',
    realWorld: { text: 'Artemis II flew four astronauts around the Moon in April 2026. Later Artemis crews aim to land near the south pole, close to ice-filled craters like the ones beside your base.', source: 'artemis-ii' },
    scripted: [{ sol: 3, eventId: 'earthrise' }],
    recommended: { modules: { solar: 2, battery: 2, recycler: 1, oxygen: 1, spares: 2 }, supplies: { o2: 100, water: 300, food: 200 } },
  },
  {
    id: 'long-night', chapter: 2, title: 'The Long Night', body: 'moon', siteId: 'tranquility',
    targetSols: 30, budgetKg: 9400, scienceGoal: 240, startDate: '2024-04-10', phaseOffsetDays: 8,
    lesson: 'Power at night: solar vs. batteries vs. nuclear.',
    teaser: 'The Sun is about to set, and it will not rise again for two weeks.',
    intro: 'In July 1969 Apollo 11 landed right here, in the Sea of Tranquility. Neil Armstrong and Buzz Aldrin stayed less than a day, in bright sunshine. You are staying 30 days. In about a week the Sun will set and not rise again for two weeks, and the ground will freeze to −130 °C. How will you keep the heaters on?',
    win: 'Sunrise! Light spills across the gray plains and your crew cheers. No human had ever lived through a lunar night, until now.',
    realWorld: { text: 'NASA is developing Fission Surface Power, a small nuclear reactor, so Moon bases can keep running through the 14-day lunar night.', source: 'kilopower' },
    scripted: [],
    recommended: { modules: { solar: 2, fission: 3, battery: 1, recycler: 1, oxygen: 1, spares: 2 }, supplies: { o2: 100, water: 400, food: 390 } },
  },
  {
    id: 'red-dust', chapter: 3, title: 'Red Dust Rising', body: 'mars', siteId: 'jezero',
    targetSols: 40, budgetKg: 8000, scienceGoal: 450, startDate: '2024-02-01', phaseOffsetDays: 0,
    lesson: 'Dust storms and solar power on Mars.',
    teaser: 'An ancient lake, a hunt for signs of life, and a storm on the horizon.',
    intro: 'Jezero Crater, Mars. Billions of years ago a river poured into a lake here and left a delta of mud and sand, one of the best places to search for signs of ancient life. Perseverance has explored it since 2021. But it is dust storm season. Watch the sky, and watch your panels.',
    win: 'The storm blew itself out, the sky turned butterscotch again, and the science never stopped. Perseverance would be proud.',
    realWorld: { text: 'In 2018 a planet-wide dust storm ended the solar-powered Opportunity rover after almost 15 years. Nuclear-powered Curiosity kept driving.', source: 'opportunity' },
    scripted: [{ sol: 6, eventId: 'dust_storm' }, { sol: 20, eventId: 'blue_sunset' }],
    recommended: { modules: { solar: 5, fission: 1, battery: 2, recycler: 1, oxygen: 1, moxie: 1, spares: 2 }, supplies: { o2: 100, water: 500, food: 520 } },
  },
  {
    id: 'solar-storm', chapter: 4, title: 'Solar Maximum', body: 'mars', siteId: 'gale',
    targetSols: 30, budgetKg: 8000, scienceGoal: 280, startDate: '2024-05-08', phaseOffsetDays: 0,
    lesson: 'Radiation: shielding, shelters and dose budgets.',
    teaser: 'May 2024: the real solar storms, replayed sol by sol from NASA data.',
    intro: 'May 2024. The Sun is near the peak of its 11-year cycle, and giant sunspots are hurling flares into space. On Earth, people as far south as Florida and Mexico will see auroras. On Mars there is no magnetic field to hide behind. This mission replays the real solar storms of that month, sol by sol, straight from NASA’s DONKI database.',
    win: 'You kept your crew safe through the strongest solar storms in more than 20 years. NASA’s space weather forecasters would hire you tomorrow.',
    realWorld: { text: 'On 20 May 2024 Curiosity’s RAD instrument recorded its biggest radiation surge since landing: 8,100 micrograys, like 30 chest X-rays.', source: 'rad-2024' },
    scripted: [],
    includeTransitDose: true,
    recommended: { modules: { solar: 4, fission: 1, battery: 2, recycler: 1, oxygen: 1, shelter: 1, spares: 2 }, supplies: { o2: 100, water: 400, food: 390 } },
  },
  {
    id: 'green-thumb', chapter: 5, title: 'Green Thumb', body: 'mars', siteId: 'arcadia',
    targetSols: 80, budgetKg: 12100, scienceGoal: 520, startDate: '2025-01-15', phaseOffsetDays: 0,
    lesson: 'Living off the land: greenhouses and ice mining.',
    teaser: 'Too far to carry everything. Time to grow, mine and recycle.',
    intro: 'Eighty sols is too long to carry all your food and water from Earth. But under the dusty plains of Arcadia Planitia, NASA orbiters have spotted ice just below the surface. Plant your seeds, start your drills, and turn a frozen desert into a garden.',
    win: 'Your crew ate a salad grown on Mars and drank water mined from Martian ice. For the first time, humans are not just visiting Mars. They are living there.',
    realWorld: { text: 'MOXIE made oxygen from Martian air, Phoenix touched Martian ice, and astronauts have eaten lettuce grown on the ISS. The pieces are coming together.', source: 'moxie' },
    scripted: [],
    recommended: { modules: { solar: 3, fission: 2, battery: 2, recycler: 1, oxygen: 1, iceDrill: 1, greenhouse: 2, spares: 3 }, supplies: { o2: 100, water: 300, food: 650 } },
  },
  {
    id: 'long-haul', chapter: 6, title: 'The Long Haul', body: 'mars', siteId: 'utopia',
    targetSols: 150, budgetKg: 16300, scienceGoal: 1300, startDate: '2024-09-01', phaseOffsetDays: 0,
    lesson: 'Everything at once: a full Mars surface mission.',
    teaser: '150 sols. Every system, every trade-off, every decision.',
    intro: 'This is the real thing: 150 sols at Utopia Planitia, where Viking 2 landed in 1976 and photographed frost on the rocks. Your crew has just spent six months in deep space, with radiation dose already on their badges. Partway through, the Sun will slip between Mars and Earth and cut you off from home. Every system, every trade-off, every decision is yours.',
    win: 'Mission complete. One hundred fifty sols, one crew, zero shortcuts. The first people to live on Mars might be sitting in a classroom right now. Maybe one of them is you.',
    realWorld: { text: 'Real plans for human Mars missions land cargo ahead of the crew and expect months on the surface, including a solar conjunction blackout.', source: 'mars-sites' },
    scripted: [{ sol: 60, eventId: 'conjunction' }, { sol: 90, eventId: 'supply_drop' }],
    includeTransitDose: true,
    recommended: { modules: { solar: 4, fission: 2, battery: 2, recycler: 1, oxygen: 1, moxie: 1, iceDrill: 1, greenhouse: 2, shelter: 1, rover: 1, relay: 1, spares: 4 }, supplies: { o2: 100, water: 300, food: 1120 } },
  },
];

export const missionById = (id) => CAMPAIGN.find((m) => m.id === id) ?? null;

export function freePlayConfig({ body, siteId, targetSols, difficulty, startDate, includeTransitDose }) {
  return {
    id: 'free-play', chapter: 0, title: 'Free Play', body, siteId,
    targetSols, budgetKg: Math.round(3500 + targetSols * 75), scienceGoal: Math.round(targetSols * 8),
    startDate, phaseOffsetDays: 0, scripted: [], includeTransitDose, difficulty,
    lesson: 'Design your own mission.', intro: 'Your mission, your rules. Good luck, Commander.', win: 'Mission accomplished!',
    recommended: null,
  };
}

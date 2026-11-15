# Sol Survivor: Junior Astronaut Mission Trainer

**NASA Space Apps Challenge 2026, Seattle**. Challenge: *Build a Junior Astronaut Mission Trainer*.

Students in grades 4–9 command a crewed outpost on the Moon or Mars, one sol at a time. They balance life support, power, food and radiation shielding, and live with the consequences, using real NASA data.

## The problem

Kids love space, but the hard part of exploration (keeping people alive far from home) is invisible in most classrooms. Oxygen budgets, the 14-day lunar night, Martian dust storms and solar radiation are real engineering trade-offs NASA plans around every day. Students rarely get to *make* those decisions and see what happens.

## Our solution

Sol Survivor is a mission simulator built on real data:

1. **Plan.** Pack a lander under a strict mass budget: solar arrays or a fission reactor, water recycler, MOXIE oxygen plant, greenhouse, storm shelter, food and water.
2. **Survive.** Each sol, assign the crew to explore, repair, build regolith shielding, tend plants or rest. The simulation tracks oxygen, water, food, power, health, morale and radiation dose.
3. **React.** Real events strike: solar storms from NASA's DONKI database, seasonal dust storms, the lunar night, solar conjunction blackouts, toxic perchlorate, buried ice.
4. **Learn.** Every event card ends with a "Real Science" note. The debrief turns the crew's dose into chest X-rays and explains what went right and what to improve.

### Features

- **Six-chapter story campaign**: the Moon's south pole, Apollo 11's Sea of Tranquility, then Jezero, Gale, Arcadia and Utopia on Mars. Each chapter adds one big trade-off and connects to a real NASA mission.
- **Free Play** at any site, plus shareable **mission codes**: the same code replays the same events for a whole class.
- **CAPCOM advisor** that forecasts how many sols each resource will last.
- **Astronaut Dictionary**: 84 kid-friendly terms in 10 topics, flashcards, and a deterministic **Word of the Sol** computed from the real Mars Sol Date.
- **Mission Quiz**: 87 questions across all 10 topics and three difficulty levels, tied to dictionary terms and campaign chapters. It is seeded so a class gets the same quiz, and it brings back questions a student missed. Six **Data Lab** questions are answered by reading the bundled NASA datasets, and the tests re-check them against the files.
- **30 mission patches** (badges) for survival, good science and study.
- **Data Lab**: Curiosity weather across 4,700+ sols, a Mars-year seasonal pressure cycle, DONKI flare and CME statistics, an Earth/Moon/Mars comparison table, a radiation dose ladder, 50 cited "Did you know?" facts, and a 23-milestone exploration timeline with NASA photos.
- **Teacher toolkit**: 10 lessons (one per chapter plus four standalone) aligned to 26 NGSS performance expectations, with exit tickets and a progress summary. See [docs/teacher-guide.md](docs/teacher-guide.md).
- **Offline-first.** All data and images are bundled, so it runs in a classroom with no internet.

## NASA data used

| Data | How we use it | Link |
|---|---|---|
| Curiosity REMS daily weather (4,745 sols, 2012–2026) | Temperature, pressure and season for every Mars sol; Data Lab charts and questions | [mars.nasa.gov/msl/weather](https://mars.nasa.gov/msl/weather/) |
| DONKI space weather, 2024–2025 (1,592 flares, 3,167 CMEs, 179 SEP events) | Real solar storms replayed as radiation alerts; Data Lab statistics | [ccmc.gsfc.nasa.gov/tools/DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) |
| Curiosity RAD measurements (Hassler 2014, Zeitlin 2013, May 2024 storm) | Surface and cruise dose rates; storm dose | [doi.org/10.1126/science.1244797](https://doi.org/10.1126/science.1244797) |
| RAD radiation comparison chart (PIA17601) | Dose ladder: CT scan, ISS, Mars trip | [photojournal.jpl.nasa.gov/catalog/PIA17601](https://photojournal.jpl.nasa.gov/catalog/PIA17601) |
| NASA Life Support Baseline Values (BVAD) | Oxygen, water and food per astronaut per day | [ntrs.nasa.gov/citations/20210024855](https://ntrs.nasa.gov/citations/20210024855) |
| NASA Planetary Fact Sheet | Earth/Moon/Mars comparison table | [nssdc.gsfc.nasa.gov/planetary/factsheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) |
| Mars24 Sunclock algorithm (NASA GISS) | Mars Sol Date, local time and season (Ls) | [giss.nasa.gov/tools/mars24](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html) |
| JPL approximate planet positions | Earth–Mars distance, light delay, solar conjunction | [ssd.jpl.nasa.gov/planets/approx_pos.html](https://ssd.jpl.nasa.gov/planets/approx_pos.html) |
| Mars Trek and Moon Trek mosaics | Landing site maps | [trek.nasa.gov](https://trek.nasa.gov/) |
| NASA Image and Video Library | Gallery and timeline photos (Apollo 8 and 11, Viking 1, Sojourner, Curiosity, Perseverance, Ingenuity, Artemis I) | [images.nasa.gov](https://images.nasa.gov/) |
| ISS ECLSS, MOXIE, Veggie, Kilopower, Phoenix, LCROSS, Artemis and other mission pages | Machine performance, Real Science notes and timeline | Listed in the in-game Data Lab |

The full bibliography (53 sources) is in `src/data/sources.js`. Every quiz question, fact, timeline entry and comparison value cites one of them, and the tests fail if a citation is missing.

## Music

Background music changes with the screen. Tracks live in `public/audio/` and load only when first needed.

| Track | File | Length | Plays on |
|---|---|---|---|
| Pale Blue | `pale-blue.mp3` | 1:25 | Home, campaign map, dictionary, academy, Data Lab and other menus |
| Near Earth | `near-earth.mp3` | 1:02 | Pack the lander (loadout) |
| Deep Space | `deep-space.mp3` | 1:02 | Moon missions |
| Alien World | `alien-world.mp3` | 1:02 | Mars missions |
| Far Shore | `far-shore.mp3` | 1:35 | While a solar storm or dust storm card is open |
| Lantern Moss | `lantern-moss.mp3` | 1:21 | Mission debrief |

**Source and license: to be confirmed.** The tracks were provided to the team; record their source and license here and in `MUSIC_CREDIT` in `src/audio/tracks.js` before publishing.

## Science validity

- Life support needs, radiation dose rates and planetary values are NASA numbers, rounded only for display.
- Data Lab quiz answers and facts (coldest night −100 °C on sol 2,803; 21 X-class flares in May 2024; the X9.0 flare of 3 October 2024) are recomputed from the bundled files in `test/content.test.js`.
- Mars time follows the published Mars24 algorithm and is tested against its reference example and against Curiosity's sol count.
- Simplifications are stated openly for students: site weather is adapted from Gale Crater, dust-storm timing is random within the real season, and machine outputs are rounded. See the teacher guide.

## Award targeting

- **Best Use of Data**: three NASA datasets drive the simulation, and students analyze the same data in the Data Lab.
- **Best Use of Science**: NASA-sourced life support and radiation models, the Mars24 clock, and cited, tested facts.
- **Best Mission Concept**: a mission planner that teaches real trade-offs: mass, power, ISRU and shielding.
- **Best Storytelling / Most Inspirational**: a six-chapter campaign from Artemis to a 150-sol Mars mission, with real NASA history at every step.
- **Galactic / Local Impact**: free, offline, classroom-ready, NGSS-aligned and accessible, built for Seattle-area classrooms and anywhere else.

## Run it

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # Vitest: engine, content integrity, learning layer, Data Lab
npm run build    # static site in dist/
```

The NASA data is already bundled in `public/`. To refresh it (raw downloads are cached in `data-src/`):

```bash
npm run fetch-data                 # every step
npm run fetch-data -- milestones   # one step: rems | donki | tiles | gallery | milestones
```

## Project layout

```
src/engine/   simulation (sim, events, scoring, advisor), Mars time, solar power, space weather,
              learning layer (learning.js, mastery.js) and Data Lab summaries (dataLab.js)
src/data/     modules, sites, campaign, event cards, dictionary, quiz, badges, lessons, NGSS,
              facts and comparison table, timeline, dose ladder, sources
public/data/  bundled NASA datasets (REMS, DONKI, gallery, milestones)
docs/         teacher guide
test/         Vitest suites
```

The learning layer is pure and immutable. `createProfile()` makes a learner profile. Functions like `gradeAnswer`, `recordMission` and `evaluateAchievements` return a new profile and never change the old one, so the UI can save each version safely.

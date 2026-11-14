# Sol Survivor: Junior Astronaut Mission Trainer

NASA Space Apps Challenge 2026, Seattle. Challenge: **Build a Junior Astronaut Mission Trainer**.

Students run a Mars or Moon outpost one sol at a time, balancing life support, radiation shielding, power and food, using real NASA data.

> Work in progress during the hackathon (Nov 14–15, 2026).

## Run it

```bash
npm install
npm run dev      # http://localhost:5180
npm test
```

The NASA data is already bundled in `public/` so the game works offline. To refresh it:

```bash
npm run fetch-data
```

## NASA data used

- Curiosity REMS daily weather, 4,745 sols (Gale Crater)
- DONKI space weather 2024–2025: 1,592 flares, 3,167 CMEs, 179 SEP events
- Mars Trek and Moon Trek global mosaics
- NASA Image and Video Library
- NASA Life Support Baseline Values and Assumptions Document (BVAD)
- Curiosity RAD radiation measurements

## For judges: NASA data in this game

Play it in a browser, no download or account: **https://cosminova.github.io/sol-survivor/**

Open the in-game **Data Lab** to see every dataset below charted, mapped and credited. Each "📊 NASA data" badge on a module or event card jumps to the matching source.

| Dataset | Where it drives gameplay | Snapshot date | Link |
| --- | --- | --- | --- |
| Curiosity REMS daily weather (Gale Crater), 4,745 sols with sol, Earth date, Ls, min/max temperature, pressure, sky opacity, UV index, sunrise and sunset | Every Mars sol's temperature (and therefore heating power), pressure and season come from the real sol with the same solar longitude. The Data Lab charts the whole record by season and explains the opacity/UV labels and sunrise/sunset times. | 2026-11-14 | https://mars.nasa.gov/msl/weather/ |
| DONKI space weather 2024–2025: 1,592 flares, 3,167 CMEs (with speeds), 179 SEP events | Real solar energetic particle events are replayed on the mission calendar as radiation storm alerts; the linked flare class sets the dose. The Data Lab charts flares and SEPs per month and reports CME counts and the fastest CME speed. | 2026-11-14 | https://ccmc.gsfc.nasa.gov/tools/DONKI/ |
| Mars Trek and Moon Trek global mosaics (Viking MDIM 2.1, LRO WAC), 32 tiles per world | Landing-site maps in the Data Lab with every selectable site plotted by its real latitude and longitude. | 2026-11-14 | https://trek.nasa.gov/ |
| NASA Image and Video Library, 21 images | Photo gallery in the Data Lab (rovers, dust storms, habitats, Artemis, MOXIE), each with date and credit. | 2026-11-14 | https://images.nasa.gov/ |
| Life Support Baseline Values and Assumptions Document (BVAD) | Oxygen, water, food and CO₂ consumed per crew member per day. | n/a (report) | https://ntrs.nasa.gov/citations/20210024855 |
| Curiosity RAD and Chang'e-4 LND radiation measurements, NASA-STD-3001 | Daily cosmic-ray dose on Mars (0.64 mSv/sol) and the Moon (1.37 mSv/day), the May 2024 storm dose, and the 600 mSv career limit used for scoring. | n/a (papers) | https://doi.org/10.1126/science.1244797 |
| Mars24 sunclock algorithm and JPL planetary positions | Solar longitude (season) for any date, Earth–Mars light delay and solar conjunction blackouts. | n/a (algorithms) | https://www.giss.nasa.gov/tools/mars24/help/algorithm.html |

The full bibliography, including the MOXIE, Kilopower, Veggie, Phoenix, Opportunity and LCROSS references behind individual event cards, lives in `src/data/sources.js` and is rendered in the Data Lab's Sources section.

**Honesty note.** All of this data is an **archived snapshot**, not a live feed. We downloaded it once with `scripts/fetch-nasa-data.mjs` (the `fetched` date is stored inside each JSON file and shown in the game) and bundled it in `public/`, so the game works offline and behaves identically for every player. A radiation storm in the game is a real DONKI event from 2024–2025 being **replayed** on your mission date; it is not a forecast and not what the Sun is doing right now. Weather for a given Mars sol is the average of real REMS sols at the same season, shifted by a fixed offset for your landing site, so numbers are realistic but not a record of any single day. Every number a player sees is traceable to a source in the Data Lab.

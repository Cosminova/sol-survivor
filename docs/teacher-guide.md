# Sol Survivor: Teacher Guide

Sol Survivor is a free, offline browser game for grades 4–9. Students run a crewed outpost on the Moon or Mars one day (sol) at a time. They pack a lander under a mass budget, keep four astronauts breathing, drinking and fed, and decide how to handle dust storms, the lunar night and real solar storms replayed from NASA data.

Every number in the game comes from a cited source, mostly NASA: Curiosity's weather station (REMS) and radiation detector (RAD), NASA's DONKI space weather database, NASA's life support handbook (BVAD) and the NASA Planetary Fact Sheet. Students can open the Data Lab to see where each number comes from.

## Before class (10 minutes)

1. Open the game in a browser (Chrome, Edge, Firefox or Safari). It runs on a laptop, Chromebook or tablet and needs no account or internet after loading.
2. Play Chapter 1 yourself once. It takes about 10 minutes.
3. Choose a **mission code** (for example `ROOM12`). Every student who types the same code gets the same random events, so results can be compared fairly.
4. Optional: in Settings, turn on larger text, high contrast or read-aloud for students who need it.

## Running a 45-minute session

| Time | What happens |
|---|---|
| 5 min | **Warm-up** from the lesson (below). Show the Word of the Sol on the home screen. |
| 5 min | Introduce the trade-off of the day: mass, power, water or radiation. |
| 20 min | Students (pairs work well) pack a lander and play one chapter with the shared mission code. |
| 10 min | Read the **debrief** together. Collect each team's points, stars and radiation dose on the board. |
| 5 min | **Exit ticket**: a 5-question Mission Quiz on that chapter, or the lesson's exit-ticket question. |

The campaign builds one idea at a time, so play the chapters in order. Each one takes 10–25 minutes.

## Lessons

Every lesson has objectives, a warm-up, steps, discussion questions, an extension and an exit ticket. The full text lives in `src/data/lessons.js` and is shown in the game's teacher area.

| Lesson | Chapter | Grades | Minutes | Big idea | NGSS |
|---|---|---|---|---|---|
| Breathe, Drink, Eat: Life Support Basics | 1 Artemis Dawn (Moon) | 4–7 | 45 | Crew needs per day; mass budgets; recycling | 3-5-ETS1-1, MS-ETS1-1, MS-LS1-3 |
| Keeping the Lights On | 2 The Long Night (Moon) | 4–7 | 45 | 14-day lunar night; kW vs. kWh; solar, battery or nuclear | 4-PS3-2, 4-PS3-4, MS-ESS1-1, MS-PS3-3 |
| Dust Storms and Solar Power | 3 Red Dust Rising (Mars) | 5–8 | 45 | Dust opacity (tau), seasons, Opportunity vs. Curiosity | MS-ESS1-1, MS-ESS3-2, 4-ESS3-1, MS-ETS1-3 |
| Space Weather: Shielding Your Crew | 4 Solar Maximum (Mars) | 5–9 | 50 | The real May 2024 solar storms; doses in millisieverts | MS-ESS3-2, MS-PS4-2, MS-ETS1-2 |
| Living off the Land | 5 Green Thumb (Mars) | 5–8 | 50 | Greenhouses, ice mining, MOXIE, closed loops | 5-LS1-1, 5-LS2-1, MS-LS1-6, MS-LS2-3, MS-ESS3-1, MS-PS1-2 |
| The Long Haul | 6 The Long Haul (Mars) | 6–9 | 50 | A full engineering design cycle using test data | MS-ETS1-1, MS-ETS1-2, MS-ETS1-4, 3-5-ETS1-2 |
| Design a Habitat on Paper | Free Play | 4–8 | 45 | Hazards, criteria and constraints, testing, peer review | 3-5-ETS1-1, 3-5-ETS1-2, 3-5-ETS1-3, MS-ETS1-1, MS-ETS1-2, MS-PS3-3 |
| Read Real Mars Weather | Data Lab | 5–8 | 40 | Graphing 4,700+ sols of Curiosity weather | 5-ESS1-2, MS-ESS1-1, MS-ESS2-5 |
| Radiation and Shielding | Data Lab + any Mars chapter | 6–9 | 45 | The NASA dose ladder; why hydrogen makes a good shield | MS-PS4-2, MS-ESS3-2, MS-ETS1-3 |
| Earth, Moon, Mars: Compare the Worlds | Data Lab | 4–8 | 40 | NASA Planetary Fact Sheet; your weight on Mars | 5-PS2-1, MS-ESS1-2, MS-ESS1-3 |

## Standards coverage

The lessons address 26 NGSS performance expectations. The strongest coverage is:

- **Engineering design** (3-5-ETS1-1 to -3, MS-ETS1-1 to -4). Every mission is a design problem with criteria (crew survives, science goal, dose limit) and constraints (mass budget). The shared mission code makes fair tests possible.
- **Earth and space science** (MS-ESS1-1, -2, -3; MS-ESS3-1, -2; 5-ESS1-2; MS-ESS2-5). Seasons on Mars (Ls), the lunar day, scale properties from the Fact Sheet, resources like buried ice, and natural hazards (dust storms, solar storms) analyzed from real data.
- **Energy** (4-PS3-2, 4-PS3-4, 4-ESS3-1, MS-PS3-3). Power budgets, solar vs. nuclear, and keeping a habitat warm.
- **Life science** (5-LS1-1, 5-LS2-1, MS-LS1-3, MS-LS1-6, MS-LS2-3). Plants, closed-loop life support and the human body in space.

The full table, listing the lessons for each code, is exported as `NGSS_ALIGNMENT` from `src/data/lessons.js`.

## Assessment ideas

- **Mission Quiz.** 87 questions across 10 topics and three difficulty levels. A quiz can focus on one chapter, one topic, or the questions a student missed before. Six "Data Lab" questions require reading real NASA data.
- **Debrief evidence.** Students quote two numbers from their debrief to support a claim ("Our recycler saved 400 kg of water, which means…").
- **Design iteration (Chapter 6).** Compare version 1 and version 2 of a team's loadout. Did the data justify each change?
- **Claim–Evidence–Reasoning.** "Is the Moon or Mars the better first home?" Students use three rows from the comparison table.
- **Progress report.** Each learner profile tracks quiz accuracy, mastery by topic, dictionary words looked up, badges and stars per chapter.
- **Badges.** 30 mission patches reward survival, good science (such as taking shelter from every solar storm) and study (such as looking up 25 dictionary words).

## Background science in one page

- **Life support** (NASA BVAD): each astronaut needs about 0.82 kg of oxygen, 3.5 kg of water and 1.8 kg of food per day. The ISS recycles about 98% of its water.
- **Radiation**: Curiosity's RAD measured 0.64 mSv per sol on Mars's surface and 1.84 mSv per day on the way there. The Moon's surface gives about 1.37 mSv per day (Chang'e-4 measurement). NASA's career limit is 600 mSv. 1 mSv is about 10 chest X-rays.
- **Solar storms** are real events from NASA's DONKI database (2024–2025). On 20 May 2024 RAD recorded 8,100 micrograys at Gale Crater, the largest surge since Curiosity landed.
- **Dust storms**: in 2018 a planet-wide storm pushed dust opacity to about 10.8 and ended the solar-powered Opportunity rover's mission.
- **Mars time**: the game uses NASA's Mars24 algorithm for the Mars Sol Date, local time and season (Ls).

## Simplifications to discuss

The game is a model, and good models are honest about their limits. Ask students to spot these:

- Weather at every Mars site is adapted from Gale Crater's REMS data, shifted for latitude and elevation.
- Dust storms happen at random within the real storm season (around Ls 180°–330°); they are not forecasts.
- Machine outputs and shielding levels are rounded for gameplay. Per-person needs and radiation rates are NASA values.
- Solar particle storms use real event dates from DONKI, with the in-game dose scaled by the strength of the linked flare.

## Sources

The game's Data Lab lists every source with a link. Key references:

- Curiosity REMS weather: https://mars.nasa.gov/msl/weather/
- DONKI space weather database: https://ccmc.gsfc.nasa.gov/tools/DONKI/
- NASA Planetary Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- Radiation dose comparisons (Curiosity RAD, PIA17601): https://photojournal.jpl.nasa.gov/catalog/PIA17601
- Why Space Radiation Matters (NASA): https://www.nasa.gov/missions/analog-field-testing/why-space-radiation-matters/
- NASA Life Support Baseline Values and Assumptions: https://ntrs.nasa.gov/citations/20210024855
- Next Generation Science Standards: https://www.nextgenscience.org/

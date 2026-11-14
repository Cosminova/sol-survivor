# Sol Survivor: balance note

One page for teammates and judges: what the resource loop is, where the trade-offs live, which knobs we turned,
what the balance targets are and which tests pin them, and exactly where real NASA data enters the mechanics.

## The loop (one sol = one turn)

Each `advanceSol` runs dawn → dusk → dawn:

1. **Space weather resolves.** If a solar particle event (SEP) was announced last sol, the dose lands now:
   `sepDoseMsv[severity]` × shelter factor (0.05 in the Storm Shelter, `sepFactor[level]` inside, halved when huddling behind the tanks).
2. **Environment.** Mars: Ls from the Mars24 clock for the sol's Earth date → the 1° REMS bucket (min/max °C, pressure) → dust
   optical depth (`baselineTau(ls)` or the active storm) → panel dust creeping up 0.2%/sol. Moon: sunlit or dark from the 29.53-day cycle.
3. **Power, by day then by night.** Solar only in daylight (`daylightHours(lat, Ls)` ≈ 12.6 h at Gale; 24 h or 0 h on the Moon),
   fission around the clock. Demand = habitat base 8 kW + heating `0.11 kW/°C` below 21 °C (day uses maxC, night uses minC) + every
   online module's kW. Day surplus charges the battery (anything beyond full is wasted); the night is paid from fission + battery.
   A night the battery cannot cover switches machines off by `priority` (rover 5, relay 5, greenhouse 4, ISRU 3, life support 1 last)
   and whatever is still unmet is the **cold fraction** of the habitat's power.
4. **Air, water, food** at BVAD rates (0.82 kg O₂, 3.5 kg water, 1.8 kg food per crew-day; EVA ×1.3 O₂). Oxygen generators split
   water into O₂ (1 kg O₂ costs 1.125 kg water and 1.5 kW); the recycler returns 98% of used water.
5. **Science** from the sol's EVA (none while sheltering or when tau > 5). **Radiation**: 0.64 mSv/sol GCR × `gcrFactor[level]`
   inside, the EVA astronaut unshielded. **Crew**: morale drift, relay bonus, rest healing only when fed and warm; cold costs
   `ceil(10 × coldFraction)` health per sol.
6. **One card at most**, triggered (SEP, dust storm, lunar night, cargo lander…) before weighted story cards.

## Trade-offs by design (and the test that proves each)

| Decision | What it costs | What it buys | Test |
|---|---|---|---|
| Pack an oxygen generator | 1.5 kW all sol (37 kWh) + 4 kg water per 3.6 kg O₂ | O₂ independence | `an oxygen generator costs water and power` |
| Solar-heavy base | the night: ~245 kWh of heating + base at −70 °C drains the battery to ~35% at Gale; surplus at noon is wasted | light modules (300 kg vs 1800 kg fission) | `night heating draws the battery down…` |
| Shelter from a SEP | no EVA (0 science), morale −2 | 15 mSv → 0.8 mSv | `shelter costs science and morale; refusing shelter costs 15 mSv` |
| Pile regolith on the roof | science −6 (two sols shoveling), +0.3 mSv outside | GCR ×0.75 and heating −15% per level | `a regolith berm costs science time now…` |
| Dust storm (tau 3, 10 sols) | solar halves; with one fission unit the battery is empty in two nights and life support is cut at night (water −14 kg/sol, O₂ not replaced) | — | `a dust storm halves solar output and forces… cuts` |
| Cargo lander | hauling is a sol of EVA: dose +0.3, science −4; or leave it for +6 science | +150 food/+200 water or +2 spares/+60 kg O₂ | `the cargo lander is not a free lunch` |
| Lunar night with one 10 kW unit | 590 kWh/night of habitat demand vs 240 kWh → 59% cold → ~4 health per day for 14 days | — | Moon suite |
| Water as shielding | 1650 kg of lander mass | +1 shielding level while stock ≥ 1500 kg | `…the water wall adds one more` |

## Tunables we moved (old → new, why)

Sourced constants (BVAD rates, radiation, solar flux, orbital elements) are untouched; a test (`sourced physical constants are unchanged`) pins them.

| Knob | Old | New | Why |
|---|---|---|---|
| `POWER.habitatBaseKw` | 3 | 8 | 4-crew habitat continuous load (lights, pumps, CO₂ scrubbing, thermal control, galley, avionics); DRA 5.0 / lunar surface studies: 8–15 kW |
| `POWER.heatKwPerDegree` | 0.012 | 0.11 | effective leak of a lightly insulated inflatable; ~10 kW at a −70 °C Gale night, ~17 kW at −130 °C lunar night, the reason FSP matters |
| `SHIELDING.bermWorkPerLevel` | 8 | 6 | a berm could never complete (the only source gave 6); now one "two sols of shoveling" choice = one level |
| `TUNING.coldHealthPerSol` | 3 flat | 10 × coldFraction | scales with how much of the habitat's power is missing; zero power at −130 °C kills in ~12 days |
| `TUNING.coldMoralePerSol` | 2 flat | 4 × coldFraction | same scaling |
| `TUNING.globalStormChance` | 0.012/sol | 0.005/sol | ~10% of 30-sol missions see the planet-wide storm (was ~25%); it is survivable with fission but costs ~20 health |
| `TUNING.bermHeatSavingPerLevel` | — | 0.15 | regolith insulates as well as shields |
| Power model | sol-averaged | day/night split | the battery meant nothing before |
| `QUICK_START_LOADOUT` (new export) | UI: solar 3, fission 1, battery 2, recycler, oxygen 2, shelter, spares 2; o2 8, water 10, food 8 | Mars: oxygen 1, relay 1, o2 2, water 5, food 3 (7630 kg). Moon: fission 2, solar 2 | 800 kg O₂ is seven months of air for 4 crew; nothing could ever run low |

Cards: `dust_storm`, `global_storm` and `supply_drop` choices now all cost something; new once-card `berm`.

## Balance targets (all enforced in `src/engine/balance.test.js`)

Mars quick start at Gale, 4 crew, 30 sols, seeds ABC123 HELLO1 ZZZ999 NASA26 MARS42 QWERTY, policy "first available choice":

| Seed | Outcome | Min battery | O₂ / water / food left | Avg dose | Min health | Note |
|---|---|---|---|---|---|---|
| ABC123 | won, 3★ | 0% | 119 / 58 / 26% | 20.7 mSv | 100 | regional dust storm sols 16–25: life support off 9 nights |
| HELLO1 | won, 3★ | 2% | 128 / 54 / 26% | 19.1 | 100 | dust storm |
| ZZZ999 | won, 3★ | 34% | 132 / 74 / 26% | 20.2 | 100 | clear: battery 34% every dawn |
| NASA26 | won, 3★ | 0% | 98 / 35 / 26% | 20.7 | 81 | planet-wide storm from sol 10; cold nights |
| MARS42 | won, 3★ | 34% | 132 / 74 / 26% | 20.2 | 100 | clear |
| QWERTY | won, 3★ | 1% | 128 / 57 / 26% | 19.2 | 100 | dust storm; berm built before the SEPs |

Also pinned: "never shelter" costs ≥ 2× the dose (63 vs 20 mSv; 1.8× when a berm already exists) for more science but a lower score;
the bare loadout loses on sol 12 (water); the legacy UI loadout still wins all six seeds; Moon quick start (two fission units) wins with
the battery at 0% and life support cut every night of the lunar night; the Mars pack on the Moon survives at ~44 health; without fission
the crew freezes on day 27. A fuzz test runs 200 random missions (both bodies, random crews, loadouts under capacity, random choices,
random 2024–2025 start dates): no exceptions, no NaN/undefined, no negative stock, `status.over` exactly on a terminal condition, and
identical replay. Health stays at 100 for a fed, warm, sheltered crew by design; it drops only when the base is genuinely stressed.

## Real-data touchpoints

| Dataset | Field(s) | Mechanic | Test |
|---|---|---|---|
| REMS (`public/data/rems.json`, Curiosity sols 10–4995) | `ls`, `minC`, `maxC`, `pressurePa` → 1° Ls buckets | daily temperatures (heating bill), pressure, "Today feels like Curiosity's sol N on <date>" every 5 sols | `REMS lookup uses the Ls of the mission date…` |
| REMS | `sunrise`, `sunset`, `uv`, `opacity` of the reference sol | shown in `env`; daylight geometry checked against 05:40→17:56 | `daylight hours from geometry agree…` |
| DONKI (`donki.json`, 2024–2025) | `seps[].t` exact timestamps, strongest `flares[].c` in the 48 h before | SEP alerts on sols 8, 9, 12 (9/10/13 May 2024: X2.2, X3.9, X1.0); `{flareClass}` `{eventDate}` in the card; dose by severity | `DONKI SEP events land on sols 8, 9 and 12…`, `dose per SEP severity…` |
| Mars24 (Allison & McEwen) | mission date → Ls 246.4°, MY37, southern spring | season, dust-storm season, REMS bucket, solar declination and day length | `REMS lookup…` |
| JPL approximate planetary elements | Earth–Mars distance 1.98 AU on 2024-05-01 | light delay 16.4 → 14.5 min over the mission, conjunction blackout when the Sun–Earth–Mars angle < 3° (none in 2024) | `light delay and conjunction geometry…` |
| Lunar synodic month 29.53 d × `site.sunlit` | Mare Tranquillitatis 0.5 → dark from day 15 to 29 | lunar night card, zero solar, −130 °C heating | `lunar night timing follows site.sunlit…` |
| BVAD, RAD 2014, LND 2020, NASA-STD-3001 | `LIFE_SUPPORT`, `RADIATION` | consumption, GCR per sol, SEP doses, 600 mSv career limit in the debrief | `sourced physical constants are unchanged` |

All of it is archived data replayed on a 2024 calendar; nothing is presented as live.

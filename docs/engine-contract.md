# Sol Survivor engine contract

The UI and the Data Lab build against this. `src/engine/mission.js` implements it. Keep the engine pure:
no DOM, no fetch, no Date.now(), no Math.random(). All randomness comes from `state.rng` (a 32-bit int,
see `src/engine/rng.js`). Every exported function returns a new state and never mutates its input.

## Exports from `src/engine/mission.js`

```js
export const LANDER_CAPACITY_KG = 12000;        // total mass budget for modules + supply crates
export const MISSION_LENGTHS = [30, 60];        // selectable sols (Moon: Earth days)
export const DEFAULT_START_DATE = '2024-05-01'; // so the real May 2024 DONKI storms land mid-mission

export function landerMass(loadout) -> { modulesKg, suppliesKg, totalKg, overBy }   // overBy > 0 means too heavy
export function createMission({ body, siteId, crew, loadout, seed, lengthSols, startDate }) -> MissionState
export function advanceSol(state) -> MissionState        // one turn; refuses (returns state unchanged) while state.pendingCard is set or state.status.over
export function applyChoice(state, choiceIndex) -> MissionState   // resolves state.pendingCard; refuses if choice not available
export function describeEffects(effects, state) -> string[]       // plain-language preview lines, e.g. "Morale −2", "Battery +40 kWh"
export function missionStatus(state) -> { over, outcome, reason, score, stars }  // same object as state.status
```

### Inputs

```js
body: 'mars' | 'moon'
siteId: id from src/data/sites.js (must match body)
crew: [{ name: string, role: 'commander' | 'engineer' | 'geologist' | 'doctor' | 'botanist' }]   // 2–4 people
loadout: { modules: { [moduleId]: count }, supplies: { o2: crates, water: crates, food: crates } }  // crates = 100 kg units, see SUPPLIES
seed: string   // the 6-char mission code from randomMissionCode(); same seed + same choices = identical mission
lengthSols: 30 | 60
startDate: ISO date string, defaults to DEFAULT_START_DATE
```

### MissionState (everything the UI reads)

```js
{
  code, seed, rng,                       // code = seed shown to players; rng = current PRNG int
  body, site,                            // site = full object from SITES
  lengthSols, sol,                       // sol = turns elapsed, 0 at landing
  date,                                  // ISO date of the current sol (Earth UTC), used to look up DONKI events
  ls, season,                            // Mars only (null on Moon); season from seasonName()
  crew: [{ name, role, health, morale, doseMsv }],     // health/morale 0–100
  modules: { [id]: count },              // packed modules
  offline: { [id]: { reason: 'storm' | 'broken' | 'off', sols } },  // sols = turns until back online; Infinity for 'off'/'broken' until repaired
  supplies: { o2Kg, waterKg, foodKg, spares },
  power: { batteryKwh, batteryMaxKwh, producedKwh, usedKwh, shortfallKwh },   // last sol's budget; shortfallKwh > 0 means things were cut
  env: { minC, maxC, avgC, pressurePa, tau, dust, stormSols, lit, lightDelayMin, blackoutSols },
       // dust = fraction of panel covered 0–0.9; lit = Moon sunlit flag (true on Mars); blackoutSols > 0 = no comms
  shielding: { level, bermWork, shelterMode },        // level 0–3 (SHIELDING), shelterMode: null | 'partial' | 'full' for the active SEP
  science: number,
  flags: { perchlorate, iceBonus, greenhouseKw, greenhouseSols, drawn: [cardId] },  // drawn = once-cards already used
  pendingCard: null | {
    id, icon, title, body, science, source, terms,     // body/title/science with {placeholders} already filled in
    choices: [{ label, available, effects, outcome, why }]   // why = reason when unavailable, e.g. "Needs a Storm Shelter"
  },
  lastSol: { log: [{ kind: 'info' | 'good' | 'warn' | 'danger', text, source? }] },   // what happened this turn, for the UI feed
  status: { over, outcome: null | 'won' | 'lost', reason, score, stars }           // stars 0–3
}
```

### Rules the engine must implement

- **Power**: produced = solar (`marsSolarKwh` / `moonSolarKwh`) + fission outputKw × hours. Used = habitat base + heating
  (`heatKwPerDegree` × degrees below target × hours) + each online module's kw × hours. Battery absorbs the difference.
  Shortfall switches off modules by `priority` (highest number first) and logs it. Life support (priority 1) goes last.
- **Air**: O2 consumed = `o2KgPerCrewDay` × crew (×1.3 for the sol's EVA crew). Produced by oxygen generators (uses water),
  MOXIE / regolith plants, greenhouse. O2 at 0 → crew health drops hard each sol; loss when any crew health hits 0.
- **Water**: consumed per crew, recovered by the recycler (`recovery`), topped up by ice drill × site.iceAccess (+iceBonus).
- **Food**: consumed per crew; greenhouse yields `foodKg` only after `growSols` of being online (track `flags.greenhouseSols`);
  halved with `flags.perchlorate`. Hungry crew lose morale then health.
- **Radiation**: each sol add `marsSurfaceGcrMsvPerSol` (or Moon rate) × `gcrFactor[level]` to every crew member.
  SEP events come from `classifySepEvents(donki)` mapped onto `state.date`: when one falls in this sol, queue the
  `sep_alert` card; the dose applied on the next advance = `sepDoseMsv[severity]` × (`shelterSepFactor` if full shelter,
  `sepFactor[level]` otherwise, halved for 'partial'). Stored water ≥ `waterWallKg` counts as one extra shielding level.
- **Environment**: Mars weather from `marsWeather(index, ls, site, rng)`; tau = `baselineTau(ls)` or the active storm's tau;
  dust grows by `dustPerSol` (`stormDustPerSol` in storms), capped at `maxDust`. Moon from `moonConditions`.
  Light delay from `lightDelaySeconds(date)`; `sunEarthMarsAngleDeg < 3` → blackout. New dust storm each sol with `dustStormChance(ls)`.
- **Events**: at most one card per sol. Triggered cards (weight 0) first: sep_alert, dust_storm, global_storm (once, only in storm season),
  lunar_night (first sol of darkness), harvest (first greenhouse harvest), supply_drop (around sol 20). Otherwise with ~45% chance
  draw a weighted card whose `bodies` includes the body, whose `condition(state)` passes, and that isn't in `flags.drawn` if `once`.
  Fill placeholders: {flareClass} {eventDate} {bodyName} {crewName} {siteName}.
- **Effects** (every key the deck uses): morale, health, science, water, food, o2, spares, dose, dust, tau, battery,
  storm{tau,sols}, shelter (true|'partial'), disable (id | [ids]) → offline 'off' until end of storm or 10 sols,
  disableSols{id,sols}, blackout (sols), shieldWork (bermWork += n, level up every bermWorkPerLevel),
  repairAll, perchlorate, iceBonus, greenhouseKw, breakChance. `requires: { module }` / `{ spares: n }` gate availability.
- **Crew**: morale drifts −1/sol, +2 with a relay online, +`restHeal` health when fed and breathing. Role bonuses:
  geologist ×1.5 science, engineer repairs one broken module per sol without spares, doctor +2 health/sol, botanist +25% harvest.
- **Score**: science + 2 × average health + average morale − total dose; stars: 3 if all crew ≥ 70 health, 2 if all alive, 1 if won at all.
- **Mission end**: won when `sol === lengthSols` with everyone alive. Lost when a crew member reaches 0 health. Reason is a short kid-readable sentence.

### Determinism test

`createMission` with the same inputs, then the same sequence of `advanceSol`/`applyChoice`, must produce identical states (`JSON.stringify` equal).

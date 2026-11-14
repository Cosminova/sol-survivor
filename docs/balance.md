# Sol Survivor: balance note

This branch merges the two parallel builds. The campaign, UI, learning layer and 3D outpost come from `main`;
the day/night power model, retuned habitat numbers and balance tests come from `feature/playable-game`.
Every NASA dataset from both branches is kept (`main` already held a superset: DONKI, REMS, gallery,
milestones, images and terrain).

## The power loop (one sol = one turn)

`computePower` in `src/engine/sim.js` runs dawn → dusk → dawn:

1. **Daylight.** Mars: hours of sun from the site latitude and season (`daylightHours`, ≈12.6 h at Gale,
   matching Curiosity's REMS sunrise/sunset). Moon: 24 h or 0 h from the 29.53-day cycle.
2. **Demand.** Habitat base 8 kW + heating 0.11 kW per °C below 21 °C (Mars day uses REMS max °C, night uses
   min °C) + every switched-on machine. Each regolith shielding level trims heating 15%.
3. **Day.** Solar + fission charge the battery; surplus beyond a full battery is wasted.
4. **Night.** Fission + battery pay the bill. If they can't, machines switch off by priority
   (rover/relay first, life support last). Whatever is still missing is the **cold fraction**, which costs
   up to 10 health and 10 morale per sol.

## Trade-offs the tests pin (`test/balance.test.js`)

| Decision | Result |
|---|---|
| Lunar night with solar + batteries only | crew freezes (lost, reason `cold`) |
| Lunar night with 1 fission unit | survives some nights, cold for more than 5 sols |
| Lunar night with 3 fission units (Recommended) | wins, never cold, but 5,400 kg of the budget is reactors |
| Mars with 2 solar arrays and no battery | mission lost |
| Never sheltering from the May 2024 DONKI storms | more science, at least 2× the radiation dose |
| Every campaign Recommended pack | fits the Specialist budget and wins on 6 seeds with health ≥ 80 |
| Mars Recommended packs | battery drops below 40% on at least one seed, so the night still matters |

Plus a 200-mission fuzz test (random loadouts and choices on both bodies): no NaN, no negative stock,
identical replay for the same mission code.

## Retuned campaign packs

The old 3 kW habitat made power almost irrelevant (battery stayed at 100% on 4 of 6 chapters) and the
Long Haul Recommended pack ran out of food on 2 of 3 seeds. New Recommended packs and budgets:

| Chapter | Budget (kg) | Power in the Recommended pack | Food (kg) |
|---|---|---|---|
| Artemis Dawn | 4,300 (unchanged) | 2 solar, 2 battery | 200 |
| The Long Night | 9,400 | 2 solar, 3 fission, 1 battery | 390 |
| Red Dust Rising | 8,000 | 5 solar, 1 fission, 2 battery | 520 |
| Solar Maximum | 8,000 | 4 solar, 1 fission, 2 battery | 390 |
| Green Thumb | 12,100 | 3 solar, 2 fission, 2 battery | 650 |
| The Long Haul | 16,300 | 4 solar, 2 fission, 2 battery | 1,120 |

Sourced constants (BVAD life support, RAD radiation, solar flux, Mars24 time) are unchanged and pinned by a test.
All NASA data is archived and bundled; nothing is presented as live.

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

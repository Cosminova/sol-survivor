// Real, named landing places on solar-system worlds other than the Moon and Mars (those stay in sites.js).
// Names and positions follow the IAU Gazetteer of Planetary Nomenclature [gazetteer]; lat/lon are planetocentric,
// east-positive, in degrees (the gazetteer lists west longitudes for Mercury and the outer moons: lon = -west).
// iceAccess and science are game scores (0..1 and about 0.8..1.6), set from what NASA missions found there.
const SITE_SOURCE = 'gazetteer';

const SITES_BY_WORLD = {
  mercury: [
    { key: 'chao-meng-fu', name: 'Chao Meng-Fu Crater', lat: -87.3, lon: -132.4, iceAccess: 0.8, science: 1.3, sunlit: 0.1,
      blurb: 'A crater at the south pole whose floor never sees the Sun. Radar found bright patches that look like ice.' },
    { key: 'prokofiev', name: 'Prokofiev Crater', lat: 86.0, lon: 63.7, iceAccess: 0.9, science: 1.2, sunlit: 0.1,
      blurb: 'A north pole crater in permanent shadow. It is cold enough to keep water ice on the hottest rocky planet.' },
    { key: 'caloris', name: 'Caloris Planitia', lat: 30.5, lon: 161.2, iceAccess: 0, science: 1.5, sunlit: 0.5,
      blurb: 'A giant basin about 1,550 km wide, made by an asteroid long ago. Scorching days and freezing nights.' },
  ],
  venus: [
    { key: 'venera-13', name: 'Venera 13 Landing Site', lat: -7.5, lon: -57.0, iceAccess: 0, science: 1.4, sunlit: 0.5,
      blurb: 'A Soviet lander took colour photos here in 1982. It lasted about two hours in the heat and crushing air.' },
    { key: 'maxwell', name: 'Maxwell Montes', lat: 65.2, lon: 3.3, iceAccess: 0, science: 1.5, sunlit: 0.5,
      blurb: 'The tallest mountains on Venus. It is a little cooler up high, but still hot enough to melt lead.' },
  ],
  io: [
    { key: 'loki', name: 'Loki Patera Rim', lat: 13.0, lon: 51.2, iceAccess: 0, science: 1.6, sunlit: 0.5,
      blurb: 'Beside a huge lava lake, the most powerful volcano on Io. Amazing science, very risky ground.' },
    { key: 'pele', name: 'Pele Plains', lat: -18.7, lon: 104.7, iceAccess: 0, science: 1.5, sunlit: 0.5,
      blurb: 'Near a volcano whose plume rises high into space and paints a giant red ring of sulfur.' },
    { key: 'prometheus', name: 'Prometheus Lava Field', lat: -1.5, lon: -153.9, iceAccess: 0, science: 1.3, sunlit: 0.5,
      blurb: 'A lava flow that has been erupting for decades. Sulfur frost covers the ground around it.' },
  ],
  europa: [
    { key: 'conamara', name: 'Conamara Chaos', lat: 9.7, lon: 87.3, iceAccess: 1, science: 1.6, sunlit: 0.5,
      blurb: 'Broken rafts of ice that once drifted and froze again. The hidden ocean may be close here.' },
    { key: 'pwyll', name: 'Pwyll Crater', lat: -25.2, lon: 88.6, iceAccess: 1, science: 1.3, sunlit: 0.5,
      blurb: 'A young crater with bright rays of fresh, clean ice thrown across the surface.' },
  ],
  ganymede: [
    { key: 'galileo-regio', name: 'Galileo Regio', lat: 47.0, lon: -129.6, iceAccess: 0.8, science: 1.2, sunlit: 0.5,
      blurb: 'A huge patch of old, dark, cratered ice. One of the oldest surfaces on the biggest moon of all.' },
    { key: 'uruk-sulcus', name: 'Uruk Sulcus', lat: 0.8, lon: -160.3, iceAccess: 0.9, science: 1.4, sunlit: 0.5,
      blurb: 'Bright ridges and grooves where the icy crust was pulled apart long ago.' },
    { key: 'tros', name: 'Tros Crater', lat: 11.1, lon: -27.3, iceAccess: 1, science: 1.3, sunlit: 0.5,
      blurb: 'A bright crater surrounded by rays of clean ice dug up by an impact.' },
  ],
  callisto: [
    { key: 'valhalla', name: 'Valhalla Basin', lat: 14.7, lon: -56.0, iceAccess: 0.8, science: 1.4, sunlit: 0.5,
      blurb: 'A giant bullseye of rings left by an ancient impact. Calm ground, far from the worst of Jupiter’s radiation.' },
    { key: 'asgard', name: 'Asgard Basin', lat: 32.2, lon: -139.9, iceAccess: 0.8, science: 1.2, sunlit: 0.5,
      blurb: 'Another ringed impact basin on the most heavily cratered world we know.' },
  ],
  titan: [
    { key: 'huygens', name: 'Huygens Landing Site', lat: -10.6, lon: 167.7, iceAccess: 0.6, science: 1.4, sunlit: 0.5,
      blurb: 'The Huygens probe landed here in 2005 on damp ground dotted with pebbles of water ice.' },
    { key: 'kraken', name: 'Kraken Mare Shore', lat: 68.0, lon: 50.0, iceAccess: 0.7, science: 1.6, sunlit: 0.4,
      blurb: 'The beach of the biggest sea on Titan. The sea is liquid methane and ethane, not water.' },
    { key: 'selk', name: 'Selk Crater', lat: 7.0, lon: 161.0, iceAccess: 0.8, science: 1.5, sunlit: 0.5,
      blurb: 'A crater among dark dunes where NASA’s Dragonfly drone plans to explore.' },
  ],
  enceladus: [
    { key: 'baghdad', name: 'Baghdad Sulcus', lat: -87.0, lon: 126.0, iceAccess: 1, science: 1.6, sunlit: 0.3,
      blurb: 'One of the “tiger stripe” cracks at the south pole, where jets of ocean water spray into space.' },
    { key: 'damascus', name: 'Damascus Sulcus', lat: -79.7, lon: 76.6, iceAccess: 1, science: 1.5, sunlit: 0.3,
      blurb: 'A warm crack in the ice next to the jets. Fresh snow from the plumes falls here.' },
  ],
};

/** @param {string} worldId @param {'moon'|'mars'} analog */
export const solSitesFor = (worldId, analog) => (SITES_BY_WORLD[worldId] ?? []).map(({ key, ...site }) => ({
  id: `${worldId}-${key}`, worldId, body: analog, ...site, source: SITE_SOURCE, origin: 'real',
}));

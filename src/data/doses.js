// Radiation dose ladder in millisieverts, smallest to largest, for the Radiation lesson and debrief comparisons.
// Most rungs are read off NASA's Curiosity RAD comparison chart (PIA17601, bundled as public/images/PIA17601.jpg).
export const DOSE_CHART = { file: 'PIA17601.jpg', source: 'rad-chart', title: 'Radiation Exposure Comparisons with Mars Trip Calculation' };

export const DOSE_LADDER = [
  { id: 'chest-xray', icon: '🩻', label: 'One chest X-ray', msv: 0.1, source: 'nasa-radiation' },
  { id: 'earth-cosmic-year', icon: '🌍', label: 'A whole year of cosmic rays at sea level on Earth', msv: 0.3, source: 'rad-chart' },
  { id: 'mars-sol', icon: '🔴', label: 'One sol on the surface of Mars', msv: 0.64, source: 'rad-2014' },
  { id: 'moon-day', icon: '🌕', label: 'One day on the surface of the Moon', msv: 1.37, source: 'lnd-2020' },
  { id: 'cruise-day', icon: '🚀', label: 'One day flying between Earth and Mars', msv: 1.84, source: 'rad-cruise' },
  { id: 'us-year', icon: '🏠', label: 'A year of radiation for an average person in the US, from all sources', msv: 3.6, source: 'rad-chart' },
  { id: 'ct-scan', icon: '🏥', label: 'One abdominal CT scan', msv: 8, source: 'rad-chart' },
  { id: 'iss-6mo', icon: '🛰️', label: 'Six months on the International Space Station', msv: 75, source: 'rad-chart' },
  { id: 'mars-500', icon: '⛺', label: '500 days living on the surface of Mars', msv: 320, source: 'rad-chart' },
  { id: 'mars-transit', icon: '☄️', label: 'A 180-day flight to Mars', msv: 330, source: 'rad-chart' },
  { id: 'career-limit', icon: '🛑', label: 'NASA’s career limit for one astronaut', msv: 600, source: 'nasa-std-3001' },
];

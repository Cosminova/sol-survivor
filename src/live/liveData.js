// Live NASA data contract. Owned by the live-data work; the UI only calls these.
// Every value carries `source` ('live' = fetched from NASA just now, 'archive' = bundled snapshot)
// and `recordedAt` (ISO time of the underlying NASA record), so the UI can label it honestly.

/**
 * @typedef {{ kind: 'flare'|'cme'|'sep'|'storm'|'alert', time: string, label: string, kidLine: string, url?: string }} SunEvent
 * @typedef {{ level: 'calm'|'busy'|'stormy', kidHeadline: string, kidLine: string, events: SunEvent[],
 *             radiationRisk: 0|1|2|3, source: 'live'|'archive', recordedAt: string|null, fetchedAt: string|null,
 *             attribution: { name: string, url: string } }} SunNow
 * @typedef {{ sol: number, earthDate: string, minC: number, maxC: number, pressurePa: number, sky: string, uv: string,
 *             source: 'live'|'archive', attribution: { name: string, url: string } }} MarsNow
 * @typedef {{ sun: SunNow, mars: MarsNow|null, loadedAt: string }} LiveNow
 */

/** Resolves quickly (cached, with timeouts); never rejects. Falls back to archive data offline. @returns {Promise<LiveNow>} */
export async function loadLive() {
  return {
    sun: { level: 'calm', kidHeadline: 'The Sun is calm today', kidLine: 'No big solar storms right now.', events: [], radiationRisk: 0,
      source: 'archive', recordedAt: null, fetchedAt: null, attribution: { name: 'NASA DONKI', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' } },
    mars: null,
    loadedAt: new Date().toISOString(),
  };
}

/** Subscribe to live updates (called again when a refresh lands). Returns an unsubscribe fn. */
export function onLive(fn) { loadLive().then(fn); return () => {}; }

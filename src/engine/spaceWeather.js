// Turns the archived DONKI catalogue into in-game radiation storm alerts.
const CLASS_RANK = { A: 0, B: 1, C: 2, M: 3, X: 4 };
const LINK_WINDOW_MS = 48 * 3600 * 1000;
const MERGE_WINDOW_MS = 24 * 3600 * 1000;

export function flareStrength(classType) {
  if (!classType) return 0;
  const letter = classType[0].toUpperCase();
  const magnitude = Number.parseFloat(classType.slice(1)) || 1;
  return (CLASS_RANK[letter] ?? 0) + Math.min(magnitude, 9.9) / 10;
}

export function severityFromFlare(classType) {
  const letter = classType?.[0]?.toUpperCase();
  if (letter === 'X') return 'major';
  if (letter === 'M') return 'moderate';
  return 'minor';
}

const SEVERITY_ORDER = { minor: 0, moderate: 1, major: 2 };

// Each SEP gets the strongest flare in the 48 h before it; near-duplicate reports are merged.
export function classifySepEvents(donki) {
  const flares = (donki?.flares ?? [])
    .filter((f) => f.t && f.c)
    .map((f) => ({ time: Date.parse(f.t), classType: f.c }))
    .sort((a, b) => a.time - b.time);
  const seps = (donki?.seps ?? []).map((s) => Date.parse(s.t)).filter(Number.isFinite).sort((a, b) => a - b);

  const classified = seps.map((time) => {
    const linked = flares.filter((f) => f.time <= time && time - f.time <= LINK_WINDOW_MS);
    const strongest = linked.reduce((best, f) => (!best || flareStrength(f.classType) > flareStrength(best.classType) ? f : best), null);
    const flareClass = strongest?.classType ?? null;
    return { time, flareClass, severity: severityFromFlare(flareClass) };
  });

  return classified.reduce((merged, event) => {
    const last = merged[merged.length - 1];
    if (last && event.time - last.time < MERGE_WINDOW_MS) {
      if (SEVERITY_ORDER[event.severity] <= SEVERITY_ORDER[last.severity]) return merged;
      return [...merged.slice(0, -1), { ...event, time: last.time }];
    }
    return [...merged, event];
  }, []);
}

export function sepBetween(events, startMs, endMs) {
  return events.find((e) => e.time >= startMs && e.time < endMs) ?? null;
}

export function monthlyActivity(donki) {
  const months = new Map();
  const bump = (iso, key) => {
    if (!iso) return;
    const month = iso.slice(0, 7);
    const entry = months.get(month) ?? { month, C: 0, M: 0, X: 0, cme: 0, sep: 0 };
    months.set(month, { ...entry, [key]: entry[key] + 1 });
  };
  for (const f of donki?.flares ?? []) {
    const letter = f.c?.[0]?.toUpperCase();
    if (letter === 'C' || letter === 'M' || letter === 'X') bump(f.t, letter);
  }
  for (const c of donki?.cmes ?? []) bump(c.t, 'cme');
  for (const s of donki?.seps ?? []) bump(s.t, 'sep');
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

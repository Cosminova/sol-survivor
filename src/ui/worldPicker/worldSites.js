// Landing sites for any world, and the evening instant the sky is drawn for. Pure logic, no DOM.
import * as siteData from '../../data/sites.js';

const EVENING_HOUR_LOCAL = 21; // the sky is shown at 9 pm local mean solar time on the chosen night
const MS_PER_HOUR = 3600000;
const DEG_PER_HOUR = 15;

/** The instant shown for a night (YYYY-MM-DD) and an observer: 9 pm local mean solar time. */
export function eveningInstant(nightIso, observer) {
  const [y, m, d] = String(nightIso).split('-').map(Number);
  if (![y, m, d].every(Number.isFinite)) return new Date();
  return new Date(Date.UTC(y, m - 1, d, EVENING_HOUR_LOCAL) - (observer.lon / DEG_PER_HOUR) * MS_PER_HOUR);
}

/**
 * Landing sites for a world. Uses sitesForWorld() from src/data/sites.js once the data work adds it, then
 * world.sites, then the Moon/Mars site lists. A world with no mapped sites gets one practice zone borrowed from
 * its analog body, so the mission can still launch.
 * @returns {{ sites: Array<object>, practice: boolean }}
 */
export function resolveSites(world, data = siteData) {
  const sitesForWorld = Reflect.get(data, 'sitesForWorld');
  const fromData = typeof sitesForWorld === 'function' ? sitesForWorld(world.id) ?? [] : [];
  const list = fromData.length ? fromData
    : world.sites?.length ? world.sites
      : world.id === 'moon' || world.id === 'mars' ? data.sitesForBody(world.id) : [];
  if (list.length) return { sites: list, practice: false };
  return { sites: data.sitesForBody(world.analog).slice(0, 1), practice: true };
}

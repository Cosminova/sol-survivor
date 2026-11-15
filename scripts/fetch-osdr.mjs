#!/usr/bin/env node
// Saves a small, curated set of real space-biology studies from NASA's Open Science Data Repository
// (OSDR) into public/data/osdr.json. OSDR only allows browser calls from osdr.nasa.gov, so the game
// cannot fetch it live: this runs at build time instead (npm run fetch-osdr).
//
// For each study we keep the title, organism and release date from the API, and a short summary made
// of sentences copied word for word from the study description. The one-line kid text below was written
// by hand from those same sentences; the script fails if a quoted sentence is no longer in the record,
// so the kid text can never drift away from what the study says.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data', 'osdr.json');
const META = (id) => `https://osdr.nasa.gov/osdr/data/osd/meta/${id}`;
const SEARCH = (term) => `https://osdr.nasa.gov/osdr/data/search?term=${encodeURIComponent(term)}&type=cgene&size=10`;
const STUDY_URL = (id) => `https://osdr.nasa.gov/bio/repo/data/studies/OSD-${id}`;

// quote: the opening words of each description sentence to keep (checked against the live record).
const STUDIES = [
  {
    id: 267, topic: 'plants', gameLink: 'greenhouse', setting: 'On the International Space Station',
    kid: 'Astronauts grew red romaine lettuce in the Veggie garden on the space station. Tests found no harmful germs on it, so it was safe to eat.',
    quote: ['To study the effects of space conditions, red romaine lettuce', 'Comparison of flight and ground tissues showed some differences', 'This study indicated that leafy vegetable crops'],
  },
  {
    id: 476, topic: 'plants', gameLink: 'greenhouse', setting: 'In a lab on Earth, using real Apollo Moon soil',
    kid: 'Seeds sprouted and grew in real Moon soil brought back by Apollo 11, 12 and 17. But the plants grew slowly and showed signs of stress.',
    quote: ['Using samples from Apollo 11, 12 and 17', 'However, our results show that growth is challenging'],
  },
  {
    id: 342, topic: 'muscle and bone', gameLink: 'low-gravity', setting: 'Mice on the International Space Station',
    kid: 'Mice lost muscle and bone during 33 days in space. Mice given a treatment that blocks two body signals built muscle and bone instead.',
    quote: ['Wild type mice lost significant muscle and bone mass', 'Systemic inhibition of MSTN/activin A signaling'],
  },
  {
    id: 396, topic: 'bone', gameLink: 'bone-loss', setting: 'Mice on the International Space Station',
    kid: 'After about four weeks on the space station, mice had lost more bone than mice on Earth, and a broken bone did not heal properly.',
    quote: ['µCT confirmed escalated bone loss', 'Concluding, spaceflight suppressed a unique biomolecular mechanism'],
  },
  {
    id: 317, topic: 'radiation', gameLink: 'radiation-shielding', setting: 'In a lab on Earth, with particle beams that copy cosmic rays',
    kid: 'Heavy particles like the ones in cosmic rays left lasting marks on the DNA of human lung cells. The scientists think marks like these could help track cancer risk for deep-space crews.',
    quote: ['Here we assessed the impact of two high-LET ions', 'Thus, high LET radiation exposure leaves a lasting imprint'],
  },
  {
    id: 689, topic: 'immune system', gameLink: 'crew-health', setting: 'In a lab on Earth, with simulated weightlessness',
    kid: 'After 25 hours of simulated weightlessness, human immune cells worked differently. The T cells and NK cells that fight germs did their jobs less well.',
    quote: ['Here, using single-cell analysis of human peripheral blood mononuclear cells', 'Microgravity directs monocyte inflammatory parameters'],
  },
  {
    id: 174, topic: 'health checks', gameLink: 'crew-health', setting: 'Astronauts on the International Space Station',
    kid: 'Scientists collected hair roots from 10 space station astronauts, 6 times each (2 of them in orbit), to see how living in space changes the way genes work.',
    quote: ['In order to investigate the genetic changes in human hair during space flight', 'Space environment induced gene expression of hair follicles'],
  },
];

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'space-game data fetch' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const sentences = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-ZµÀ-Ý])/);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchStudy(spec) {
  const meta = await getJson(META(spec.id));
  const study = meta?.study?.[`OSD-${spec.id}`]?.studies?.[0];
  if (!study?.title || !study?.description) throw new Error(`OSD-${spec.id}: no title or description in the OSDR record`);
  const all = sentences(study.description);
  const summary = spec.quote.map((start) => {
    const found = all.find((s) => s.startsWith(start));
    if (!found) throw new Error(`OSD-${spec.id}: the description no longer contains a sentence starting "${start}". Re-read the study and update the kid text.`);
    return found;
  }).join(' ');

  let organism = null;
  try {
    const hits = (await getJson(SEARCH(`OSD-${spec.id}`)))?.hits?.hits ?? [];
    const hit = hits.find((h) => h?._source?.Accession === `OSD-${spec.id}`);
    organism = hit?._source?.organism?.replace(/\s{2,}/g, ', ').trim() || null;
  } catch (err) {
    console.warn(`  OSD-${spec.id}: organism lookup failed (${err.message})`);
  }

  return {
    id: `OSD-${spec.id}`,
    title: study.title.trim(),
    organism,
    released: study.publicReleaseDate ?? null,
    topic: spec.topic,
    gameLink: spec.gameLink,
    setting: spec.setting,
    kid: spec.kid,
    summary,
    url: STUDY_URL(spec.id),
  };
}

const findings = [];
for (const spec of STUDIES) {
  const finding = await fetchStudy(spec);
  findings.push(finding);
  console.log(`  ${finding.id}  ${finding.organism ?? 'organism not listed'}  ${finding.title.slice(0, 70)}`);
  await pause(400);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  source: 'NASA Open Science Data Repository (OSDR), Ames Research Center',
  url: 'https://osdr.nasa.gov/bio/repo/',
  fetched: new Date().toISOString().slice(0, 10),
  note: 'Saved study records. "summary" is copied word for word from each study description; "kid" is a plain-language line written from that summary.',
  findings,
}, null, 1)}\n`);
console.log(`Wrote ${findings.length} OSDR findings to ${path.relative(ROOT, OUT)}`);

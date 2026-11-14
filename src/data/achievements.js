// Mission patches (badges). check(ctx) receives { mission, debrief, profile }; mission/debrief are the
// just-finished mission (or null). Every check must be safe with nulls and with a fresh profile.
import { CAMPAIGN, missionById } from './missions.js';
import { GLOSSARY } from './glossary.js';
import { gcrPerSol } from '../engine/sim.js';
import { masteryByCategory } from '../engine/mastery.js';

export const ACHIEVEMENT_CATEGORIES = {
  mission: { label: 'Mission Patches', icon: '🚀' },
  science: { label: 'Science & Engineering', icon: '🔬' },
  learning: { label: 'Astronaut Training', icon: '🎓' },
  explorer: { label: 'Explorer', icon: '🧭' },
};

const won = (ctx) => ctx.mission?.status === 'won';
const stats = (ctx) => ctx.mission?.stats ?? {};
const completed = (ctx) => ctx.profile?.completed ?? {};
const quiz = (ctx) => ctx.profile?.quiz ?? {};
const count = (list) => (Array.isArray(list) ? list.length : 0);
const includesAll = (list, ids) => ids.every((id) => (list ?? []).includes(id));

const bodyOfEntry = ([id, entry]) => entry?.body ?? missionById(id)?.body;
const completedOn = (ctx, body) => Object.entries(completed(ctx)).some((e) => bodyOfEntry(e) === body)
  || (won(ctx) && ctx.mission.config?.body === body);
const completedChapter = (ctx, id) => Boolean(completed(ctx)[id]) || (won(ctx) && ctx.mission.config?.id === id);

function lowDose(ctx) {
  const m = ctx.mission;
  if (!won(ctx) || !m.sol) return false;
  const surface = m.crew.reduce((s, c) => s + c.doseMsv - c.transitDoseMsv, 0) / m.crew.length;
  return surface <= 0.5 * gcrPerSol(m.config.body) * m.sol;
}

export const ACHIEVEMENTS = [
  // Mission
  { id: 'first-landing', icon: '🛬', category: 'mission', title: 'First Landing', desc: 'Complete any mission.',
    check: (ctx) => won(ctx) || count(Object.keys(completed(ctx))) > 0 },
  { id: 'moonwalker', icon: '🌕', category: 'mission', title: 'Moonwalker', desc: 'Complete a mission on the Moon.',
    check: (ctx) => completedOn(ctx, 'moon') },
  { id: 'red-planeteer', icon: '🔴', category: 'mission', title: 'Red Planeteer', desc: 'Complete a mission on Mars.',
    check: (ctx) => completedOn(ctx, 'mars') },
  { id: 'two-worlds', icon: '🌗', category: 'mission', title: 'Two Worlds', desc: 'Complete missions on both the Moon and Mars.',
    check: (ctx) => completedOn(ctx, 'moon') && completedOn(ctx, 'mars') },
  { id: 'three-stars', icon: '⭐', category: 'mission', title: 'Three-Star Commander', desc: 'Earn 3 stars on any mission.',
    check: (ctx) => ctx.debrief?.score?.stars === 3 || Object.values(completed(ctx)).some((e) => e?.stars >= 3) },
  { id: 'night-shift', icon: '🌑', category: 'mission', title: 'Night Shift', desc: 'Keep your crew warm through the 14-day lunar night.',
    check: (ctx) => completedChapter(ctx, 'long-night') },
  { id: 'storm-rider', icon: '🌪️', category: 'mission', title: 'Storm Rider', desc: 'Complete a Mars mission that had a dust storm.',
    check: (ctx) => won(ctx) && ctx.mission.config?.body === 'mars' && stats(ctx).storms > 0 },
  { id: 'sun-shield', icon: '🛡️', category: 'mission', title: 'Sun Shield', desc: 'Take cover from every solar storm in a mission.',
    check: (ctx) => stats(ctx).sepEvents > 0 && stats(ctx).sepSheltered >= stats(ctx).sepEvents },
  { id: 'all-home', icon: '💚', category: 'mission', title: 'Everyone Home Healthy', desc: 'Finish a mission with every astronaut above 80% health.',
    check: (ctx) => won(ctx) && ctx.mission.crew.every((c) => c.health >= 80) },
  { id: 'commander-class', icon: '🎖️', category: 'mission', title: 'Commander Class', desc: 'Complete a mission on Commander difficulty.',
    check: (ctx) => won(ctx) && ctx.mission.config?.difficulty === 'commander' },
  { id: 'long-hauler', icon: '🚀', category: 'mission', title: 'The Long Haul', desc: 'Survive 150 sols on Mars.',
    check: (ctx) => completedChapter(ctx, 'long-haul') || (won(ctx) && ctx.mission.config?.body === 'mars' && ctx.mission.sol >= 150) },
  { id: 'campaign-complete', icon: '🏆', category: 'mission', title: 'Mission Planner', desc: 'Complete all six campaign chapters.',
    check: (ctx) => CAMPAIGN.every((c) => completedChapter(ctx, c.id)) },

  // Science & engineering
  { id: 'first-harvest', icon: '🥬', category: 'science', title: 'Green Thumb', desc: 'Harvest food your crew grew.',
    check: (ctx) => stats(ctx).foodGrown > 0 },
  { id: 'ice-miner', icon: '🧊', category: 'science', title: 'Ice Miner', desc: 'Mine 100 kg of water from buried ice in one mission.',
    check: (ctx) => stats(ctx).waterMined >= 100 },
  { id: 'air-maker', icon: '🌬️', category: 'science', title: 'Air Maker', desc: 'Make 50 kg of oxygen on site in one mission.',
    check: (ctx) => stats(ctx).o2Made >= 50 },
  { id: 'closed-loop', icon: '♻️', category: 'science', title: 'Closed Loop', desc: 'Recycle 500 kg of water in one mission.',
    check: (ctx) => stats(ctx).waterRecycled >= 500 },
  { id: 'fix-it', icon: '🔧', category: 'science', title: 'Fix-It Crew', desc: 'Repair 3 broken machines in one mission.',
    check: (ctx) => stats(ctx).repairs >= 3 },
  { id: 'bunker-builder', icon: '⛏️', category: 'science', title: 'Bunker Builder', desc: 'Build 2 levels of regolith shielding.',
    check: (ctx) => (ctx.mission?.shield?.level ?? 0) >= 2 },
  { id: 'dose-detective', icon: '☢️', category: 'science', title: 'Dose Detective', desc: 'Finish a mission with under half the radiation an unprotected crew would get.',
    check: lowDose },
  { id: 'science-star', icon: '🔭', category: 'science', title: 'Science Star', desc: 'Reach a mission’s science goal.',
    check: (ctx) => Boolean(ctx.mission) && ctx.mission.science >= ctx.mission.config.scienceGoal },

  // Astronaut training
  { id: 'first-quiz', icon: '❓', category: 'learning', title: 'Curious Cadet', desc: 'Answer your first quiz question.',
    check: (ctx) => quiz(ctx).answered >= 1 },
  { id: 'quiz-whiz', icon: '🧠', category: 'learning', title: 'Quiz Whiz', desc: 'Answer 50 quiz questions correctly.',
    check: (ctx) => quiz(ctx).correct >= 50 },
  { id: 'perfect-round', icon: '💯', category: 'learning', title: 'Perfect Round', desc: 'Get every answer right in a quiz round of 5 or more questions.',
    check: (ctx) => Object.values(quiz(ctx).best ?? {}).some((v) => v >= 1) },
  { id: 'word-collector', icon: '📖', category: 'learning', title: 'Word Collector', desc: 'Look up 25 words in the Astronaut Dictionary.',
    check: (ctx) => count(ctx.profile?.termsViewed) >= 25 },
  { id: 'walking-dictionary', icon: '📚', category: 'learning', title: 'Walking Dictionary', desc: 'Look up every word in the Astronaut Dictionary.',
    check: (ctx) => includesAll(ctx.profile?.termsViewed, GLOSSARY.map((t) => t.id)) },
  { id: 'flashcard-ace', icon: '🃏', category: 'learning', title: 'Flashcard Ace', desc: 'Mark 20 flashcards as known.',
    check: (ctx) => count(ctx.profile?.flashcardsKnown) >= 20 },
  { id: 'well-rounded', icon: '🧭', category: 'learning', title: 'Well-Rounded', desc: 'Reach 50% mastery in every dictionary category.',
    check: (ctx) => Boolean(ctx.profile) && Object.values(masteryByCategory(ctx.profile)).every((v) => v >= 0.5) },

  // Explorer
  { id: 'science-reader', icon: '🔬', category: 'explorer', title: 'Real Science Reader', desc: 'Read 10 Real Science cards during missions.',
    check: (ctx) => count(ctx.profile?.eventsSeen) >= 10 },
  { id: 'seen-it-all', icon: '🗂️', category: 'explorer', title: 'Seen It All', desc: 'Experience 20 different mission events.',
    check: (ctx) => count(ctx.profile?.eventsSeen) >= 20 },
  { id: 'sky-watcher', icon: '🌅', category: 'explorer', title: 'Sky Watcher', desc: 'See Earthrise, a blue Martian sunset and a Martian aurora.',
    check: (ctx) => includesAll(ctx.profile?.eventsSeen, ['earthrise', 'blue_sunset', 'aurora']) },
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id) ?? null;

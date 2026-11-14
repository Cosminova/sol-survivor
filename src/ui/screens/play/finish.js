// Wraps up a finished mission: score + debrief, campaign progress, learner profile and newly earned badges.
import { debrief } from '../../../engine/scoring.js';
import { getState, setProfile, recordProgress, setLastResult, update } from '../../../state/store.js';
import { call } from '../../../state/learn.js';

export function finishMission(mission) {
  const report = debrief(mission);
  const { score } = report;
  recordProgress(mission.config.id, { stars: score.stars, points: score.points, won: score.won });

  const { profile } = getState();
  const recorded = call('recordMission', [profile, mission, report], () => profile);
  const ach = call('evaluateAchievements', [recorded, { mission, debrief: report }], () => ({ profile: recorded, newlyEarned: [] }));
  setProfile(ach.profile);

  const newBadges = (ach.newlyEarned ?? []).map(({ id, icon, title, desc }) => ({ id, icon, title, desc }));
  setLastResult({ mission, debrief: report, newBadges, at: new Date().toISOString() });
  update((st) => ({ ...st, newBadges }));
  return { report, newBadges };
}

export function noteEventSeen(eventId) {
  const { profile } = getState();
  setProfile(call('recordEventSeen', [profile, eventId], () => profile));
}

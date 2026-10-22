'use strict';

// Admit complete parties and place every party member on the same faction.
// A partially cancelled party is never turned into individual solo entries.
function selectParties(entries, limit) {
  const units = new Map();
  for (const e of entries) {
    const key = e.party || `solo:${e.accountId}`;
    if (!units.has(key)) units.set(key, []);
    units.get(key).push(e);
  }
  const selected = []; const counts = [0, 0];
  const cs = Number(entries[0]?.mode.game_mode) === 15;
  for (const unit of units.values()) {
    const expected = unit[0].partyMembers;
    if (expected && (expected.length !== unit.length || !expected.every(id => unit.some(e => e.accountId === id)))) continue;
    if (selected.length + unit.length > limit) continue;
    let team = counts[0] <= counts[1] ? 0 : 1;
    if (cs && counts[team] + unit.length > 4) team = 1 - team;
    if (cs && counts[team] + unit.length > 4) continue;
    counts[team] += unit.length;
    selected.push(...unit.map(e => ({ ...e, team: cs ? team + 1 : 0 })));
  }
  return selected;
}
module.exports = { selectParties };

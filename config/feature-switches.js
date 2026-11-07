'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'feature-switches.json');

// `state` describes server readiness, not merely whether the client has a UI.
// Keeping this metadata beside the protocol ids prevents an administrator from
// accidentally exposing a menu backed only by an empty compatibility stub.
const definitions = Object.freeze([
  { id: 26, key: 'world_chat', label: 'World chat', state: 'working', enabled: true, description: 'World channel over the dedicated chat service.' },
  { id: 70, key: 'world_chat_rejoin', label: 'World chat rejoin', state: 'working', enabled: true, description: 'Reconnect the world channel after a network interruption.' },
  { id: 81, key: 'in_game_chat', label: 'In-game chat', state: 'working', enabled: true, description: 'Realtime match text and quick-chat relay.' },
  { id: 47, key: 'new_team_ui', label: 'New team UI', state: 'working', enabled: true, description: 'Squad creation, invitations, ready state and leader flow.' },
  { id: 50, key: 'intimacy', label: 'Intimacy and special friends', state: 'planned', enabled: false, description: 'Friend intimacy, relationship levels and special-friend presentation.' },
  { id: 56, key: 'workshop', label: 'Workshop', state: 'planned', enabled: false, description: 'Workshop catalogue, crafting and upgrade persistence.' },
  { id: 79, key: 'workshop_matchmaking', label: 'Workshop targeted matchmaking', state: 'planned', enabled: false, description: 'Workshop-specific matchmaking routing.' },
  { id: 21, key: 'championship', label: 'Championship entrance', state: 'planned', enabled: false, description: 'Championship registration, schedule and team progression.' },
  { id: 53, key: 'cup_protocol', label: 'Cup protocol', state: 'planned', enabled: false, description: 'Cup and tournament protocol support.' },
  { id: 54, key: 'competition', label: 'Competition entrance', state: 'planned', enabled: false, description: 'Competition discovery and participation.' },
  { id: 82, key: 'fitting_room', label: 'Fitting room', state: 'working', enabled: true, description: 'Unlock, save and restore fitting-room slots.' },
  { id: 84, key: 'loading_show', label: 'Loading-screen presentation', state: 'working', enabled: true, description: 'Client loading-screen presentation.' },
  { id: 85, key: 'report_mail_feedback', label: 'Report-mail feedback', state: 'planned', enabled: false, description: 'Report results and follow-up mail.' },
  { id: 20, key: 'after_match_reward_ad', label: 'Rewarded ads after matches', state: 'planned', enabled: false, description: 'Post-match ad verification and reward grants.' },
  { id: 38, key: 'optional_download_resume', label: 'Resume optional downloads', state: 'working', enabled: true, description: 'Resume interrupted optional resource downloads.' },
  { id: 51, key: 'optional_download_auto', label: 'Automatic optional downloads', state: 'working', enabled: false, description: 'Automatically download optional resources.' },
  { id: 66, key: 'clan_lucky_bag', label: 'Clan lucky bags', state: 'planned', enabled: false, description: 'Clan lucky-bag creation, claims and rewards.' },
  { id: 87, key: 'clan_lucky_bag_batch', label: 'Batch clan lucky-bag draw', state: 'planned', enabled: false, description: 'Batch lucky-bag claims.' },
  { id: 80, key: 'mentor_student', label: 'Mentor and student system', state: 'planned', enabled: false, description: 'Mentoring relationships, missions and rewards.' },
  // The wire switch has inverse semantics: true means hide the signature.
  { id: 46, key: 'social_signature_hidden', label: 'Hide social signatures', state: 'working', enabled: false, description: 'Hide player profile signatures. Leave disabled to show saved signatures.' },
  { id: 55, key: 'chat_reporting', label: 'Chat reporting', state: 'working', enabled: true, description: 'Report a chat message and persist moderation evidence.' },
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stored() {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
function list() {
  const values = stored();
  return definitions.map((definition) => ({
    ...definition,
    enabled: typeof values[definition.key] === 'boolean' ? values[definition.key] : definition.enabled,
  }));
}
function set(key, enabled) {
  const definition = definitions.find((entry) => entry.key === key);
  if (!definition) throw new Error(`Unknown feature switch: ${key}`);
  if (typeof enabled !== 'boolean') throw new Error('enabled must be true or false');
  if (enabled && definition.state === 'planned') throw new Error(`${definition.label} has no complete server implementation yet`);
  const values = stored();
  values[key] = enabled;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
  fs.renameSync(`${file}.tmp`, file);
  return list().find((entry) => entry.key === key);
}
function protocolValue() {
  return { switchs: list().map(({ id, enabled }) => ({ id, is_open: enabled })) };
}

module.exports = { file, definitions, list, set, protocolValue, clone };

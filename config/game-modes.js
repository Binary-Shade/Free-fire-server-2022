'use strict';

// Client 1.70 identifiers recovered from EMatch + gamemode_and_map_config.
// This is the single allow-list used by discovery and matchmaking so the UI
// cannot advertise a mode that the gateway silently rewrites to Clash Squad.
const MAPS = Object.freeze({
  BERMUDA: 1,
  PURGATORY: 3,
  KALAHARI: 4,
  ALPINE: 14,
  TRAINING: 7,
});
const GAME = Object.freeze({ BATTLE_ROYALE: 1, CLASH_SQUAD: 15, TRAINING: 23 });
const MATCH = Object.freeze({ CASUAL: 1, RANKED: 2, TRAINING: 5, CS_RANKED: 6 });

const modes = Object.freeze([
  { key:'classic_bermuda', label:'Classic · Bermuda', map_id:MAPS.BERMUDA, game_mode:GAME.BATTLE_ROYALE, match_mode:MATCH.CASUAL, sort_id:1, tag:0, group_modes:[0,1,3], state:'preview' },
  { key:'classic_purgatory', label:'Classic · Purgatory', map_id:MAPS.PURGATORY, game_mode:GAME.BATTLE_ROYALE, match_mode:MATCH.CASUAL, sort_id:2, tag:0, group_modes:[0,1,3], state:'preview' },
  { key:'classic_kalahari', label:'Classic · Kalahari', map_id:MAPS.KALAHARI, game_mode:GAME.BATTLE_ROYALE, match_mode:MATCH.CASUAL, sort_id:3, tag:0, group_modes:[0,1,3], state:'preview' },
  { key:'classic_alpine', label:'Classic · Alpine', map_id:MAPS.ALPINE, game_mode:GAME.BATTLE_ROYALE, match_mode:MATCH.CASUAL, sort_id:4, tag:1, group_modes:[0,1,3], state:'preview' },
  { key:'ranked_battle_royale', label:'Ranked Battle Royale', map_id:MAPS.BERMUDA, game_mode:GAME.BATTLE_ROYALE, match_mode:MATCH.RANKED, sort_id:5, tag:1, group_modes:[0,1,3], random_maps:[MAPS.BERMUDA,MAPS.PURGATORY,MAPS.KALAHARI,MAPS.ALPINE], state:'preview' },
  { key:'clash_squad', label:'Clash Squad', map_id:MAPS.BERMUDA, game_mode:GAME.CLASH_SQUAD, match_mode:MATCH.CASUAL, sort_id:6, tag:1, group_modes:[3], state:'working' },
  { key:'training', label:'Training Grounds', map_id:MAPS.TRAINING, game_mode:GAME.TRAINING, match_mode:MATCH.CASUAL, sort_id:7, tag:0, group_modes:[0], state:'working' },
]);

function find(mode={}) {
  const map=Number(mode.map_id), game=Number(mode.game_mode), match=Number(mode.match_mode);
  return modes.find(x=>x.game_mode===game && x.match_mode===match && (x.map_id===map || (x.random_maps||[]).includes(map))) || null;
}
function normalize(mode={}) {
  const candidate={map_id:Number(mode.map_id)||MAPS.BERMUDA,game_mode:Number(mode.game_mode)||GAME.CLASH_SQUAD,match_mode:Number(mode.match_mode)||MATCH.CASUAL,difficulty:Number(mode.difficulty)||0,group_mode:Number(mode.group_mode)||0};
  const definition=find(candidate);
  if(!definition) return { ...candidate, map_id:MAPS.BERMUDA, game_mode:GAME.CLASH_SQUAD, match_mode:MATCH.CASUAL, group_mode:3, definition:modes.find(x=>x.key==='clash_squad') };
  return { ...candidate, definition };
}
function openingInfo(){
  return modes.map(x=>({
    map_id:x.map_id,name:x.label,game_mode:x.game_mode,match_mode:x.match_mode,sort_id:x.sort_id,
    start_time:'00:00',end_time:'23:59',is_new:x.tag===1,is_live_open:true,
    config_start_time:'2020-01-01 00:00:00',config_end_time:'2035-12-31 23:59:59',
    weekday:'1;2;3;4;5;6;7',tips:x.state==='working'?'Permanent':'Preview',language:'en',
    limited_count:0,tag:x.tag,difficulty:'0',is_random:Array.isArray(x.random_maps),is_force_random:false,
    player_count_limit:x.game_mode===GAME.BATTLE_ROYALE?'50':'8'
  }));
}

module.exports={MAPS,GAME,MATCH,modes,find,normalize,openingInfo};

'use strict';
const { requireAccount } = require('./_shared');
const schedule = require('./GetNewPlayerRewardsList').rewards;

function grant(account, awards) {
  for (const award of awards || []) {
    if (Number(award.award_type) === 2) account.coins = Number(account.coins || 0) + Number(award.award_num || 0);
    if (Number(award.award_type) === 3) account.gems = Number(account.gems || 0) + Number(award.award_num || 0);
  }
  account.wallet = account.wallet || {};
  account.wallet.coins = Number(account.coins || 0);
  account.wallet.gems = Number(account.gems || 0);
}
function info(_req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const claimed = new Set((account.new_player_rewards || []).map(Number));
  const age = Math.max(1, Math.min(7, Math.floor((Date.now() - Number(account.created_at || Date.now())) / 86400000) + 1));
  return { day: age, expire_time: Math.floor(Number(account.created_at || Date.now()) / 1000) + 30 * 86400,
    reward_items: schedule.map((entry) => ({ day: entry.id, if_signed: claimed.has(entry.id), signin_awards: entry.awards,
      tab_cdn_url: '', achievement_id: entry.id })), activitys: [] };
}
function claim(req, ctx) {
  const account = requireAccount(ctx);
  const day = Number(req && req.day);
  const reward = schedule.find((entry) => entry.id === day);
  if (!account || !reward) return {};
  account.new_player_rewards = Array.isArray(account.new_player_rewards) ? account.new_player_rewards.map(Number) : [];
  const availableDay = Math.floor((Date.now() - Number(account.created_at || Date.now())) / 86400000) + 1;
  if (day <= Math.max(1, availableDay) && !account.new_player_rewards.includes(day)) {
    grant(account, reward.awards);
    account.new_player_rewards.push(day);
    ctx.savePlayer();
  }
  return {};
}
function claimActivity(_req, _ctx) { return {}; }

module.exports = { endpoints: [
  { endpoint: 'GetAccountFreshInfo', reqType: 'Empty', resType: 'CSGetAccountFreshInfoRes', handler: info },
  { endpoint: 'ClaimFreshSigninRewards', reqType: 'CSClaimFreshSigninRewardsReq', resType: 'Empty', handler: claim },
  { endpoint: 'ClaimFreshActivityRewards', reqType: 'CSClaimFreshActivityRewardsReq', resType: 'Empty', handler: claimActivity },
] };

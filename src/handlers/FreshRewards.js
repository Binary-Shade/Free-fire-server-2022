'use strict';
const { requireAccount } = require('./_shared');
const settings = require('../../config/new-player-rewards');
const { createdAtMs } = require('./GetNewPlayerRewardsList');

function grant(account, awards) {
  for (const award of awards || []) {
    if (Number(award.award_type) === 2) account.coins = Number(account.coins || 0) + Number(award.award_num || 0);
    if (Number(award.award_type) === 3) account.gems = Number(account.gems || 0) + Number(award.award_num || 0);
    if (Number(award.award_type) === 5) account.exp = Number(account.exp || 0) + Number(award.award_num || 0);
    if (Number(award.award_type) === 6) account.activeness = Number(account.activeness || 0) + Number(award.award_num || 0);
    if (Number(award.award_type) === 7) account.accelerators = Number(account.accelerators || 0) + Number(award.award_num || 0);
    if (Number(award.award_type) === 1) {
      account.backpack = account.backpack || { items: [] };
      account.backpack.items = Array.isArray(account.backpack.items) ? account.backpack.items : [];
      const itemId = Number(award.award_id || 0);
      const amount = Number(award.award_num || 0);
      const existing = account.backpack.items.find((item) => Number(item.id) === itemId);
      if (existing) existing.cnt = Number(existing.cnt || 0) + amount;
      else account.backpack.items.push({ id: itemId, cnt: amount, expire_time: 0, left_use_times: -1, history_owned_cnt: amount, item_status: 1 });
    }
  }
  account.wallet = account.wallet || {};
  account.wallet.coins = Number(account.coins || 0);
  account.wallet.gems = Number(account.gems || 0);
}
function info(_req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const current = settings.read();
  if (!current.enabled) return { day: 0, expire_time: 0, reward_items: [], activitys: [] };
  const schedule = settings.protocolSchedule(current);
  const claimed = new Set((account.new_player_rewards || []).map(Number));
  const age = Math.max(1, Math.floor((Date.now() - createdAtMs(account)) / 86400000) + 1);
  return { day: age, expire_time: Math.floor(createdAtMs(account) / 1000) + current.expiryDays * 86400,
    reward_items: schedule.map((entry) => ({ day: entry.id, if_signed: claimed.has(entry.id), signin_awards: entry.awards,
      // Zero means the reward is gated only by its login day. A non-zero value
      // makes the client wait for a matching achievement before enabling Claim.
      tab_cdn_url: '', achievement_id: 0 })), activitys: [] };
}
function claim(req, ctx) {
  const account = requireAccount(ctx);
  const day = Number(req && req.day);
  const current = settings.read();
  const schedule = settings.protocolSchedule(current);
  const reward = schedule.find((entry) => entry.id === day);
  if (!account || !current.enabled || !reward) return {};
  account.new_player_rewards = Array.isArray(account.new_player_rewards) ? account.new_player_rewards.map(Number) : [];
  const created = createdAtMs(account);
  const availableDay = Math.floor((Date.now() - created) / 86400000) + 1;
  const expiresAt = created + current.expiryDays * 86400000;
  if (Date.now() < expiresAt && day <= Math.max(1, availableDay) && !account.new_player_rewards.includes(day)) {
    grant(account, reward.awards);
    account.new_player_rewards.push(day);
    ctx.savePlayer();
  }
  return {};
}
function claimActivity(_req, _ctx) { return {}; }

module.exports = { grant, info, claim, endpoints: [
  { endpoint: 'GetAccountFreshInfo', reqType: 'Empty', resType: 'CSGetAccountFreshInfoRes', handler: info },
  { endpoint: 'ClaimFreshSigninRewards', reqType: 'CSClaimFreshSigninRewardsReq', resType: 'Empty', handler: claim },
  { endpoint: 'ClaimFreshActivityRewards', reqType: 'CSClaimFreshActivityRewardsReq', resType: 'Empty', handler: claimActivity },
] };

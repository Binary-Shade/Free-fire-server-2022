'use strict';

const { requireAccount } = require('./_shared');
const attendanceList = require('./GetAttendanceList');

function signIn(req, ctx) {
  const account = requireAccount(ctx);
  if (!account || Number(req && req.attendance_config_id) !== 1) return { sign_id: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const state = account.attendance && account.attendance.config_id === 1
    ? account.attendance : { config_id: 1, claimed_days: [], last_date: '' };
  if (state.last_date === today) return { sign_id: 0 };
  const claimed = new Set(Array.isArray(state.claimed_days) ? state.claimed_days.map(Number) : []);
  const next = attendanceList.REF_ATTENDANCE.find((entry) => !claimed.has(entry.day));
  if (!next) return { sign_id: 0 };
  claimed.add(next.day);
  state.claimed_days = [...claimed].sort((a, b) => a - b);
  state.last_date = today;
  state.updated_at = Date.now();
  account.attendance = state;
  if (next.reward_id === 10000004) account.coins = Number(account.coins || 0) + next.reward_amount;
  ctx.savePlayer();
  return { sign_id: next.day };
}

function getAttendance(req, ctx) {
  return { attendance_res: attendanceList.handler(req, ctx) };
}

module.exports = { endpoints: [
  { endpoint: 'AttendanceSignin', reqType: 'CSAttendanceSigninReq', resType: 'CSAttendanceSigninRes', handler: signIn },
  { endpoint: 'GetAttendance', reqType: 'CSGetAttendanceReq', resType: 'GetAttendanceRes', handler: getAttendance },
] };

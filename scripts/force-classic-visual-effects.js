'use strict';

// One-time data migration for accounts that uploaded a No Blood/Dark setting.
// Usage: node scripts/force-classic-visual-effects.js [path/to/accounts.db]

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { forceClassicBloodMode } = require('../src/handlers/PlayerCloudSettings');

const dbPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'accounts.db'));
if (!fs.existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const backupPath = `${dbPath}.before-classic-${stamp}.bak`;
const db = new Database(dbPath);

async function main() {
  try {
    await db.backup(backupPath);
    const rows = db.prepare("SELECT account_id, state FROM accounts WHERE state IS NOT NULL AND state <> ''").all();
    const update = db.prepare('UPDATE accounts SET state = ? WHERE account_id = ?');
    let changed = 0;
    let cloudRows = 0;
    let invalid = 0;

    const migrate = db.transaction(() => {
      for (const row of rows) {
        let state;
        try { state = JSON.parse(row.state); } catch (_) { invalid++; continue; }
        const stored = state && state.cloud_settings;
        if (!stored || !stored.settings) continue;
        cloudRows++;
        let original;
        try { original = Buffer.from(stored.settings, 'base64'); } catch (_) { invalid++; continue; }
        const normalized = forceClassicBloodMode(original);
        if (!normalized.equals(original)) {
          stored.settings = normalized.toString('base64');
          stored.version = 'server-classic-v1';
          stored.updated_at = Date.now();
          update.run(JSON.stringify(state), row.account_id);
          changed++;
        }
      }
    });
    migrate();
    console.log(JSON.stringify({ db: dbPath, backup: backupPath, accounts: rows.length, cloudRows, changed, invalid }));
  } finally {
    db.close();
  }
}

main().catch((err) => { console.error(err.stack || err); process.exitCode = 1; });

# OBB-to-server consistency audit

Generated: 2026-11-01T12:57:10.439Z

## Summary

- passed: 13
- failed: 0
- warnings: 1
- items: 427
- weapons: 116
- skins: 810
- maps: 71
- httpEndpoints: 418
- udpCommands: 526
- realHandlers: 127
- stubbedHandlers: 320

## Checks

- PASS — Item IDs are unique
- PASS — Weapon IDs are unique
- PASS — Regional weapon-skin duplicates keep one weapon identity
- PASS — India or global fallback covers every weapon skin
- PASS — Every weapon ammo ID exists in ItemTable
- PASS — Every skin references an existing weapon
- PASS — WeaponTable.csv embedded copy matches protocol source
- PASS — WeaponSkin.csv embedded copy matches protocol source
- PASS — Map configuration IDs are unique
- PASS — Training Grounds mapping is 7023 / map 7 / mode 23
- PASS — Endpoint map and command map agree
- PASS — RUDP enum command IDs are unique
- PASS — Audited OBB identity is unchanged

## Remaining protocol coverage

- 320 of 418 named HTTP endpoints still use the generic compatibility response.
- This is an implementation-coverage warning, not an OBB mismatch. The OBB does not define HTTP behavior.

See `obb-server-audit.json` for machine-readable details and the complete stub list.

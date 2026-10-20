# Project status and remaining work

The current MVP includes local and hosted authentication, lobby/profile services, vault and inventory responses, matchmaking, Clash Squad, custom-room cards and lifecycle, training-ground routing, Redis handoff, the TCP gateway, the UDP match server, an administration dashboard, configurable lobby content, and configurable AI opponents.

The bot implementation now supports multiple balanced opponents, opposing-side spawn selection, movement and target selection, aiming and server-authoritative damage, ammunition/reload state, purchasing, cover selection, gloo walls, grenades, reviving, and difficulty presets. Static collider geometry is loaded from `data/bot-geometry.json` to prevent shots through permanent map walls. The dashboard controls opponent count, difficulty, purchasing, cover, reviving, and gloo-wall behavior.

The chat service now listens on TCP port 10200 and uses the same authenticated encrypted framing as the game gateway. It supports world, team, group, clan, whisper, room, cup, and series channels; Redis fan-out; independent chat presence; offline whispers; bounded history; rate limiting; reports; and acknowledgement packets. Protocol and deployment details are in `protocol/CHAT_PROTOCOL.md`.

The largest remaining work is:

1. Repeatable live multiplayer validation with two to eight physical clients, including movement, combat, knockdown/revive, round transitions, disconnect/reconnect, and settlement.
2. Bot tuning against more map geometry, especially stairs, doors, narrow passages, dynamic gloo walls, cover scoring, and weapon-specific behavior.
3. Training-ground validation on every supported client build, including spawn height, map identifiers, return-to-lobby behavior, and simultaneous players.
4. Remaining custom-room operations such as spectators, invitations, host transfer, room-code concurrency, password rooms, and rejoin handling.
5. Exact historical Clash Squad parity for shop rotations, armor repair, loss-streak economy, draw handling, AFK handling, and final stat settlement.
6. HTTP feature parity for optional systems such as ranked seasons, clans, pets, gifting, workshop maps, event stores, quests, and social features.
7. Automated end-to-end coverage for login, lobby, room creation, matchmaking, UDP gameplay, chat, settlement, packet loss, and reconnects.
8. Production hardening: protect the admin dashboard, rotate all production secrets, use PostgreSQL for durable state, add backups, health checks, monitoring, log retention, and abuse limits.

The next useful milestone is an automated two-client flow covering authentication, room creation, chat, match start, movement, combat, settlement, and return to the room. It will catch protocol regressions before bot behavior and optional game systems are expanded further.
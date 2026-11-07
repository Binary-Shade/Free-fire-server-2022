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


There is still a large amount of dormant Free Fire functionality in the server. The audit found three main groups.

  ### Client configuration without dashboard controls

  LoginGetDesc sends 33 configurable sections, but the dashboard currently controls only lobby banners, marquee text,
  characters, bots, and feedback.

  Useful remaining dashboard candidates include:

  - Advertisements and splash banners
  - Activities and event dates
  - Gacha banners and probability displays
  - Store tabs and store availability
  - Gift store configuration
  - Bundles and optional bundles
  - Treasure-box configuration
  - Ranking-season configuration
  - Clash Squad ranking configuration
  - Full-screen notices and cinematics
  - Live/esports links
  - Share links and universal links
  - Character-awakening availability
  - Weapon-skin system activation time
  - Item and feature hiding
  - Quit-control rules
  - Friend-system configuration

  These are defined in FreeFireServer-master/src/handlers/_loginDescData.js:19.

  ### Missing feature switches

  The original response contained approximately 199 feature switches, but our trimmed response currently sends only one
  anonymous entry:

  switchs_res: {
    switchs: [{ is_open: true }]
  }

  Because the entry has no switch ID, most client features use their default state. Relevant switches include:

  - World chat
  - In-game chat
  - New team UI
  - Intimacy and special friends
  - Workshop
  - Championship and competition entrances
  - Fitting room
  - Loading-screen presentation
  - Report-mail feedback
  - Rewarded ads after matches
  - Optional-download behavior
  - Clan lucky bags
  - Mentor/student system
  - Social signature visibility

  A feature-switch manager in the dashboard would be valuable, but switches should only be enabled when their backend
  endpoints work.

  ### Backend endpoints without real implementation

  The endpoint map contains:

  - 418 unique known HTTP endpoints
  - 100 dedicated handler endpoints
  - 347 endpoints currently handled by the generic empty-response stub

  The numbers overlap slightly because some dedicated handlers cover endpoints outside the original map.

  Major unimplemented groups include:

  - Pets, pet feeding, skins, and skills
  - Workshop maps, uploads, downloads, likes, and recommendations
  - Ranked leaderboards and season history
  - Clan wars and clan rewards
  - Cup and championship teams
  - Mentor and student systems
  - Intimacy and special-friend relationships
  - Daily quests and attendance rewards
  - Event missions and reward claims
  - Lucky wheel, mystery shop, treasure boxes, and several gacha variants
  - VIP cards and subscriptions
  - Gift sending
  - Player blocking and aliases
  - Cloud settings upload/download
  - Weapon-skin upgrading
  - Match likes
  - Account deletion and account binding

  The fallback is implemented in FreeFireServer-master/src/handlers/_stubs.js:1. It returns an empty protobuf response,
  which prevents client crashes but does not implement the feature.

  ### Partially implemented handlers

  Some endpoints have dedicated files but still return empty or minimal responses, including:

  - Ads
  - Avatar skill-slot information
  - Daily leaderboards
  - Facebook/platform friends
  - Clan applications and invitations
  - New-player rewards
  - Rebate rewards
  - Agora voice tokens
  - CSV configuration
  - Mail reward claiming
  - Gacha extra rewards

  ### Realtime gameplay gaps

  The match server still contains incomplete behavior for:

  - Reliable UDP ACK and resend handling
  - First-blood rewards
  - Full grenade-authoritative damage behavior
  - Complete passive-character abilities
  - Complete active-skill coverage
  - Advanced bot navigation and utility behavior
  - Spectator and reconnect edge cases
  - AFK handling
  - Exact historical shop rotation and loss-streak economy
  - Complete training-ground interactions
  - Complete match result and ranking progression

  The highest-value next step is a dashboard-driven feature-switch system combined with an implementation-status
  registry. It should show each feature as:

  - Working
  - Configurable
  - Partially implemented
  - Stubbed
  - Unsafe to enable

  That would prevent enabling client buttons whose 347 backend routes still return empty responses.
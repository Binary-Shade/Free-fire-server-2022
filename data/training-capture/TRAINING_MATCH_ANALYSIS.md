# Training Grounds protocol capture

Captured on 2026-10-23 from the installed reference client while one Training Grounds session was played.

## Capture integrity and route

- Raw capture: `training-live.etl` (7.98 MB)
- Converted capture: `training-live.pcapng` (13.8 MB)
- Packets: 47,538
- Dropped packets: 1; ETL event loss: 0
- Decoded match datagrams: 37,686; decode failures: 0
- Session duration: about 313 seconds
- Matchmaker: TCP `137.59.53.150:15320`
- Match transport: UDP `137.59.53.150:15312`
- Per-match TEA key: retained in `remote-analysis.json`

This session used the reference server directly. The Android HTTP proxy does not redirect UDP match traffic, so this capture documents the reference protocol rather than a run against the local server.

## Session lifecycle

The matchmaker response supplied the UDP endpoint and per-match encryption key. The client then sent commands 1, 423, and 424. The server completed initialization with commands 100, 101, 118, 130, 176, and 587. Fourteen player entities were registered. Commands 145 and 146 formed a server teleport/client acknowledgement pair and occurred twice: once at entry and once following a later death or reset event.

Normal play used command 1001 for movement, 900 for replicated player state, 901 for game state, and 1000 for match-clock synchronization. Commands 104/105 controlled start/stop firing; 106 carried hit reports; 107 reported deaths. Reloading used 133/134. Inventory, equipment, attachments, dropped items, and actions appeared on 174, 121, 124, 112, and 201. Gloo-wall placement, damage, and removal appeared on 218, 219, and 221.

## Exact Alok behavior

The local entity was `0x0d00000d`. The client sent command 244 twice with entity ID and runtime skill ID 2206. For the first activation, the server replied after 68 ms with command 246 states `2, 0, 1` and these authoritative times:

- cast time: 349.20599 match seconds
- effect end: cast time + 10 seconds
- cooldown end: cast time + 45 seconds

At effect expiry, state `2` repeated with the same timing data. At cooldown expiry, state `4` arrived with all timing fields zero. This final transition is what restores the ready skill-button UI. The second activation showed the same start and ten-second effect-end sequence, but the session ended before its nominal cooldown completed.

The local Go server now emits this complete sequence. Tests verify one state-4 notification after cooldown, zero timing fields, and no repeated ready notifications.

## Training-specific traffic

The following commands were observed but have no handler or constant in the current local server. Their exact names still require client-code or controlled interaction correlation:

| Direction | Command | Count | Evidence-based role |
|---|---:|---:|---|
| C2S | 301 | 1 | Initial Training configuration or position |
| C2S/S2C | 326/316 | 1/1 | Request followed by a 387-byte catalogue/list response |
| C2S/S2C | 318/317 | 2/2 | Paired Training interaction response |
| C2S | 322 | 1 | Occurred before a death/teleport cycle; possible respawn request |
| C2S | 315 | 1 | Occurred near session exit/finalization |
| S2C | 319 | 31 | Repeated Training state update |
| C2S | 370 | 12 | One-byte boolean interaction/state toggle |
| C2S/S2C | 375/376 | 3/37 | Interaction request followed by entity/position records |
| S2C | 253 | 2 | Empty notification |
| S2C | 254 | 108 | Nine-byte per-entity state records |
| S2C | 285 | 40 | Entity-pair plus one-byte state |
| S2C | 458 | 143 | Roster/status list updates |
| S2C | 587 | 1 | Empty initialization notification |

Commands 316/317/318/326 are strong candidates for the Training shop or catalogue flow because of their request/response shape. That meaning is not yet proven. Commands 322 and 315 likewise need one-action-at-a-time captures before assigning permanent names.

## Client errors seen during the session

The client logged repeated `EndOfStreamException` errors while deserializing some server messages. The game remained playable, so these were recoverable, but they show that the reference build and server disagree on one or more optional message layouts. Future decoding should correlate each exception timestamp with the decoded command stream before copying those payloads into the local implementation.

## Implementation order

1. Accept this client's 423/424 join flow alongside the existing legacy join commands.
2. Reproduce command 301 initialization using a controlled entry capture.
3. Resolve the 326/316 and 318/317 request-response schemas for Training equipment or shop behavior.
4. Confirm command 322 with an isolated respawn test and implement it with 145/146 teleport acknowledgement.
5. Confirm command 315 during an isolated exit test.
6. Decode 319, 370, 375/376, 253/254, 285, 458, and 587 only as their UI actions are isolated.
7. Reuse the already implemented movement, combat, damage, inventory, gloo-wall, and active-skill systems.

## Reproduction tools

- `../../scripts/analyze-pcapng.js` extracts transport flows and matchmaker material.
- `../../scripts/decode-rudp-analysis.js` decrypts and inventories reliable-UDP commands using a supplied per-match key.
- `remote-analysis.json` contains the parsed flow.
- `decoded-rudp.json` contains decoded command records.
- `training-live-logcat.txt` contains the Android runtime log.

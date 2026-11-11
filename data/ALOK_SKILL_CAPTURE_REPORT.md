# Alok skill capture (Nostalgia MAX 2.53.2)

Captured on 2026-10-23 from `com.tech.nostalgiemax` while the user exercised Alok in Training Grounds.

## Transport

- Match transport: UDP
- Client: `192.168.1.2:58660`
- Server: `137.59.53.150:15310`
- Capture: `alok-skill-live.pcapng`
- Match-flow duration: about 699 seconds
- Match datagrams use the `0x6c` reliable-UDP envelope.
- The envelope exposes the command ID, sequence/order IDs, encryption flags, and encrypted payload length. The application payload is TEA-encrypted.

## Observed Alok flow

The client sent command **244** (`C2S_RUDP_UseActiveSkillReq`) six times. Every request was 36 bytes and carried the same 24-byte encrypted application payload. Sequence and order IDs changed, while the application payload stayed identical.

Logical request before transport encryption:

```text
u32 player_entity_id
u32 runtime_skill_id   // Alok = 2206
```

The server answered with command **246** (`S2C_RUDP_SyncActiveSkillState`). Decrypting it with the per-match key revealed a 30-byte payload. The server sent the ordered state sequence `2, 0, 1` together within 76-135 ms, then repeated state `2` about 10.1 seconds later.

| Client command 244 time (UTC) | First command 246 | End-state window |
|---|---:|---:|
| 05:32:32.083 | 76 ms | 10.101 s |
| 05:35:25.103 | 135 ms | 10.171 s |
| 05:37:40.102 | 85 ms | 10.167-10.302 s |
| 05:38:45.745 | 109 ms | 10.123 s |
| 05:40:07.815 | 91 ms | 10.152 s |
| 05:42:58.956 | 104 ms | 9.973-10.405 s |

Logical command 246 state:

```text
u32 player_entity_id
u32 runtime_skill_id
u32 state              // 0 casting, 1 effecting, 2 stopped/reset
f32 cast_time          // match-clock seconds
u32 cooldown_end_ms    // cast_time + 45 seconds, in milliseconds
u32 phase              // zero for captured Alok activations
f32 effect_end_time    // cast_time + 10 seconds
i16 pending_phase_count
```

## Behavior inferred from the capture

1. The skill button sends command 244 over the existing match UDP session; this is not an HTTP API request.
2. The server validates the authenticated entity, equipped runtime skill, alive state, and cooldown.
3. The server publishes command 246 states `2, 0, 1` so the caster and other clients clear stale state and render the new aura consistently.
4. During Alok's roughly 10-second active period, the server updates authoritative HP through player-state replication (command 900 in the compatible protocol).
5. The server repeats command 246 state `2` with the original activation deadlines after the effect duration. That state removes the aura while preserving the HUD's 45-second cooldown timeline.
6. A second Training Grounds capture confirmed command 246 state `4` when the 45-second cooldown finishes. Its timing fields are all zero. This transition restores the ready skill-button UI.
7. Cooldown presses are normally suppressed by the client HUD. The server must still reject command 244 received before cooldown expiry without sending a false stopped-state update.

The six successful uses were separated by at least 65 seconds, so this capture did not include a deliberate press during cooldown. It confirms successful cast/effect/end synchronization but does not directly capture the client's cooldown-error UI path.

The follow-up capture on 2026-10-23 observed state `4` about 45.16 seconds after the first activation. A second activation ended with the match before the complete cooldown window, so its early reset is not evidence for a shorter cooldown.

## Supporting artifacts

- `alok-skill-live.pcapng`: raw packet capture
- `alok-skill-logcat.txt`: Android log during the test
- `alok-skill-analysis.json`: parsed and direction-corrected flow data
- `../scripts/analyze-pcapng.js`: PCAPNG parser used for this analysis

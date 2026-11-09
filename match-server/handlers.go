package main

import (
	"encoding/binary"
	"fmt"
	"log"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

func reconnectKey(payload []byte) string {
	if len(payload) < 4 {
		return ""
	}
	n := int(binary.LittleEndian.Uint32(payload))
	if n <= 0 || n > 128 || 4+n > len(payload) {
		return ""
	}
	return string(payload[4 : 4+n])
}

// route dispatches one decoded packet to its handler. The ack + the serve()/run() routing are
// done by dispatch; route runs either inline (pre-match) or on run()'s goroutine (via the mailbox).
// Each case is a thin delegate — the actual work lives in the handleXxx methods below.
func (s *session) route(p *packet.Packet) {
	// Training interactions travel over the encrypted realtime UDP connection,
	// outside the HTTP proxy. Keep a focused decoded trace so controlled client
	// captures reveal the command and RUDP send-option/channel used by each UI
	// action without logging high-rate movement and replication traffic.
	if s.match != nil && s.match.training && p.Cmd >= 300 && p.Cmd < 400 {
		log.Printf("[training-trace] C2S cmd=%d so=%d seq=%d order=%d flags=%d len=%d payload=%x",
			p.Cmd, p.SendOption, p.SeqID, p.OrderID, p.Flags, len(p.Payload), p.Payload)
	}
	switch p.Cmd {
	case packet.CmdHello, packet.CmdReconnect: // 1 / 5
		s.handleHello(p)
	case packet.CmdAck: // 2 — consumed by dispatch before routing (writer ACK window).
	case packet.CmdPing: // 3
		s.handlePing(p)
	case packet.CmdJoinMatchPrepare: // 439 — buffers the (bigger) prepare_token chunk
		s.handleJoinMatchPrepare(p)
	case packet.CmdJoinMatchPost: // 440
		s.handleJoinMatchPost(p)
	case packet.CmdCSPurchase: // 408
		s.handleCSPurchase(p)
	case packet.CmdAddIcewall: // 218 — client's gloo-wall PLACE request (bidirectional cmd)
		s.handlePlaceIcewall(p)
	case packet.CmdIcewallTakeDamage: // 219 — a placed gloo wall took damage
		s.handleIcewallDamage(p)
	case packet.CmdTakeDamage: // 106
		s.handleTakeDamage(p)
	case packet.CmdWeaponAction: // 104 — start-fire / weapon-lift: relay + set the fire-state
		s.handleWeaponAction(p)
	case packet.CmdStopFire: // 105 — stop firing
		s.handleStopFire(p)
	case packet.CmdReloadStart, packet.CmdReloadFinish: // 133 / 134 — relay the reload animation
		s.handleReloadRelay(p)
	case packet.CmdProjectileThrow, packet.CmdProjectileExplode, packet.CmdStartGrenade, packet.CmdStopGrenade: // 160-163 — relay grenade throw/explode/windup
		s.handleProjectileRelay(p)
	case packet.CmdStartSniper: // 137 — scope open: set the ADS pose (PRI field 12) + relay
		s.handleStartSniper(p)
	case packet.CmdStopSniper: // 138 — scope close
		s.handleStopSniper(p)
	case packet.CmdChangeHeldItem: // 108
		s.handleChangeHeldItem(p)
	case packet.CmdEquip: // 119 — inventory slot swap (drag an item to another loadout slot)
		s.handleEquip(p)
	case packet.CmdPickupInventory: // 111 — pick up a ground-loot item
		s.handlePickup(p)
	case packet.CmdDropInventory: // 112 — drop a loadout weapon to the ground
		s.handleDrop(p)
	case packet.CmdUseInventory: // 113 — finished using a consumable (medkit heal-over-time)
		s.handleUseInventory(p)
	case packet.CmdTryUseInventory: // 131 — started channelling a consumable
		s.handleTryUseInventory(p)
	case packet.CmdUseActiveSkill: // 244 — active character ability button
		s.handleUseActiveSkill(p)
	case packet.CmdUseActiveSkillLegacy: // 235 — Barbosa/early-1.70 active ability
		s.handleUseActiveSkill(p)
	case packet.CmdStopActiveSkill: // 245 — client cancelled a cancelable ability
		s.handleStopActiveSkill(p)
	case packet.CmdStopActiveSkillLegacy: // 236 — Barbosa/early-1.70 cancel
		s.handleStopActiveSkill(p)
	case packet.CmdEmote: // 369 — play emote: relay the animation to others
		s.handleEmote(p)
	case packet.CmdInGameChat: // 1030 — match text/quick-chat relay
		s.handleInGameChat(p)
	case packet.CmdBattleFlagReq: // 276 — client planted a flag-emote flag: spawn/replace the named world object
		s.handleBattleFlagReq(p)
	case packet.CmdEquipAttachment: // 122 — client's manual attachment equip (server auto-maxes)
		s.handleEquipAttachment(p)
	case packet.CmdUnequipAttachment: // 123 — never unequip; attachments stay locked on
		s.handleUnequipAttachment(p)
	case packet.CmdClientPos: // 1001
		s.handleClientPos(p)
	case packet.CmdPlayerQuitReq: // 191
		s.handlePlayerQuit(p)
	case packet.CmdStartRescue: // 142 — teammate began reviving a knocked player
		s.handleStartRescue(p)
	case packet.CmdStopRescue: // 143 — teammate stopped reviving
		s.handleStopRescue(p)
	case packet.CmdConfirmForceSync:
		s.handleConfirmForceSync(p)
	case packet.CmdManualChallenge:
		s.handleManualChallenge(p)
	case packet.CmdManualZoneEnterExit:
		s.handleManualZoneEnterExit(p)
	case packet.CmdAddFakeTimesReq:
		s.handleAddFakeTimes(p)
	case packet.CmdTrainingInit:
		s.handleTrainingInit(p)
	case packet.CmdTrainingCatalogReq:
		s.handleTrainingCatalogReq(p)
	case packet.CmdTrainingIntoPortal, packet.CmdTrainingEnterShop:
		s.handleTrainingTrigger(p)
	case packet.CmdTrainingSelectItem:
		s.handleTrainingSelectItem(p)
	case packet.CmdTrainingRespawn:
		s.handleTrainingRespawn(p)
	case packet.CmdTrainingExit:
		log.Printf("[mm-udp] cmd=315 Training exit/finalize (%dB): %x", len(p.Payload), p.Payload)
	default:
		s.handleUnknown(p)
	}
}

// handleInGameChat preserves the client encoded body and fans it to the other
// participants. The sender already renders its own message locally.
func (s *session) handleInGameChat(p *packet.Packet) {
	if s.match == nil || len(p.Payload) == 0 || len(p.Payload) > 4096 {
		return
	}
	s.match.broadcastToOthers(s, packet.CmdInGameChat, append([]byte(nil), p.Payload...))
	log.Printf("[mm-udp] in-game chat uid=%d bytes=%d", s.player.AccountID, len(p.Payload))
}

// handleHello answers HELLO / reconnect with S2C_Hello_Res. A cmd 5 reconnect
// echoes the opaque SessionKey issued on the first HELLO, so a changed UDP
// source port can reclaim the existing transport without rebuilding the scene.
func (s *session) handleHello(p *packet.Packet) {
	if p.Cmd == packet.CmdReconnect && s.match == nil {
		key := reconnectKey(p.Payload)
		sessionsMu.Lock()
		old := sessionsByKey[key]
		valid := old != nil && old.match != nil && !old.match.ended
		sessionsMu.Unlock()
		if valid {
			s.sessionKey = key
			res := packet.BuildHelloRes(key, 0, 0, false)
			s.sendHelloRes(res)
			old.enqueue(func() { old.match.resumeTransport(old, s) })
			log.Printf("[mm-udp] fast reconnect session=%s old=%v new=%v", key, old.remote, s.remote)
			return
		}
	}
	if s.sessionKey == "" {
		s.sessionKey = newSessionKey()
		sessionsMu.Lock()
		sessionsByKey[s.sessionKey] = s
		sessionsMu.Unlock()
	}
	res := packet.BuildHelloRes(s.sessionKey, 0, 0, false)
	s.sendHelloRes(res)
	log.Printf("[mm-udp] HELLO(cmd=%d) %v -> S2C_Hello_Res (%dB)", p.Cmd, s.remote, len(res))
}

// handlePing echoes the ping back unreliably to keep the client's ping timer alive.
func (s *session) handlePing(p *packet.Packet) {
	s.write(&packet.Packet{SendOption: packet.SendUnreliable, Cmd: packet.CmdPing, Flags: 0, Payload: p.Payload})
}

// handleJoinMatchPost handles cmd 440: decode the prepare_token, resolve the player,
// pick a spawn, answer the join (cmd 100/101/130), and start the CS state stream.
//
// NOTE: cmd 110 BattleStart is NOT used for Contra Squad — it triggers
// LoadMPBattleGame(CREATE_NEW_CONN) (leave waiting island), which just makes the CS
// client reconnect without unlocking movement. The GRI (cmd 901) is the movement
// driver; the authoritative spawn is the position in cmd 101 (see choosePlayerSpawn).
func (s *session) handleJoinMatchPost(p *packet.Packet) {
	s.player = resolvePlayer(s.prepareToken(p.Payload))
	s.joined = true
	if matchManager.resume(s) {
		return
	}
	matchManager.join(s) // Step 5b: route to a match (existing with room, else new) + admit
}

// handleJoinMatchPrepare handles cmd 439 (JOIN_MATCH_PREPARE): the client sends the
// prepare_token (JWT) here as [u32 totalLen][token chunk] when it is large. A small token
// skips 439 and rides entirely in cmd 440; a token too big for one packet is split, the
// bigger half here and the tail in cmd 440. We buffer this chunk (and its declared total
// length); handleJoinMatchPost reassembles the full token.
func (s *session) handleJoinMatchPrepare(p *packet.Packet) {
	if len(p.Payload) < 4 {
		return
	}
	chunkLen := binary.LittleEndian.Uint32(p.Payload[0:])
	chunk := p.Payload[4:]
	if chunkLen > 0 && int(chunkLen) < len(chunk) { // never keep more than declared
		chunk = chunk[:chunkLen]
	}
	s.prep439 = append([]byte(nil), chunk...)
	log.Printf("[mm-udp] JOIN_MATCH_PREPARE cmd=439 token chunk=%dB (declared %d) %v", len(s.prep439), chunkLen, s.remote)
}

// prepareToken reassembles the prepare_token (JWT) from the buffered cmd 439 chunk and
// the cmd 440 payload. It can arrive wholly in cmd 440 (small token), wholly in cmd 439,
// or split across 439 (bigger chunk) + 440 (tail). The 1.70 cmd 440 struct offsets don't
// line up, so scanning for the fixed JWT header marker is the reliable path.
func (s *session) prepareToken(payload440 []byte) string {
	if len(s.prep439) > 0 {
		tok := message.ExtractJWT(s.prep439) // chunk starts at the JWT header
		if tok == "" {
			tok = string(s.prep439) // no marker (raw token bytes) — take as-is
		}
		// The 439 chunk is the bigger half; when it isn't already a whole JWT the tail (the
		// rest of the signature) rides in cmd 440 as the last length-prefixed base64url
		// field, after the metadata. Append it to complete the token.
		if !message.IsCompleteJWT(tok) {
			tail := message.LastJWTField(payload440)
			tok += tail
			log.Printf("[mm-udp] JOIN prepare_token split: 439(%dB)+440 tail(%dB) -> %dB %v",
				len(s.prep439), len(tail), len(tok), s.remote)
		} else {
			log.Printf("[mm-udp] JOIN prepare_token whole in cmd 439 (%dB) %v", len(tok), s.remote)
		}
		return tok
	}
	if tok := message.ExtractJWT(payload440); tok != "" {
		log.Printf("[mm-udp] JOIN prepare_token found in cmd 440 by scan (%dB) %v", len(tok), s.remote)
		return tok
	}
	if req, err := message.ParseJoinMatchReq(payload440); err == nil && req.Token != "" {
		log.Printf("[mm-udp] JOIN prepare_token from cmd 440 struct field (%dB) %v", len(req.Token), s.remote)
		return req.Token
	}
	log.Printf("[mm-udp] JOIN no prepare_token; cmd440(%dB)=%x %v", len(payload440), payload440, s.remote)
	return ""
}

// The cmd-1001 movement state. The client's upstream is id(4) + a 36-byte CORE (pos(12)+moveDir(6)+
// targetDir(4)+velocity(6)+moveState(1)+flag(1)+aimDir(6)); a platform byte may or may not follow.
// The downstream relay entry is [u8 slot] ++ a 37-byte body (the core + a platform byte). See
// cs-movement-sync.
const (
	moveCoreLen = 36
	moveBodyLen = 37
)

// handleClientPos parses the client's per-tick position update (cmd 1001): it stores the local
// player's world position for the SafeZone out-of-zone check AND the full state body for the
// movement relay (Step 6). Payload leads with [id u32][X i32][Y i32][Z i32] (coords ×1000 mm),
// then dirs/velocity/state — 45 bytes on foot.
func (s *session) handleClientPos(p *packet.Packet) {
	if len(p.Payload) < 16 {
		return
	}
	x := int32(binary.LittleEndian.Uint32(p.Payload[4:]))
	y := int32(binary.LittleEndian.Uint32(p.Payload[8:]))
	z := int32(binary.LittleEndian.Uint32(p.Payload[12:]))
	pos := message.Vec3{X: float64(x) / 1000, Y: float64(y) / 1000, Z: float64(z) / 1000}
	s.playerPos = pos
	// Keep the state body for the relay batch. Upstream = id(4) + 36-byte core (pos..aim); the
	// platform byte may or may not follow. Take the core from [4:40] and the platform from [40] if
	// present (else 0); the downstream entry is [slot] ++ this 37-byte body.
	if len(p.Payload) >= 4+moveCoreLen {
		if len(s.moveBody) != moveBodyLen {
			s.moveBody = make([]byte, moveBodyLen)
		}
		copy(s.moveBody, p.Payload[4:4+moveCoreLen])
		if len(p.Payload) > 4+moveCoreLen {
			s.moveBody[moveCoreLen] = p.Payload[4+moveCoreLen] // platform byte, if the client sent it
		} else {
			s.moveBody[moveCoreLen] = 0
		}
		// Learn this exact client build's ordinary locomotion enum for server bots.
		// Core offsets: velocity=22..27, moveState=28. Values are not stable across
		// builds (in 1.70, the previously assumed value 2 opens the parachute).
		vx := int16(binary.LittleEndian.Uint16(p.Payload[4+22:]))
		vy := int16(binary.LittleEndian.Uint16(p.Payload[4+24:]))
		vz := int16(binary.LittleEndian.Uint16(p.Payload[4+26:]))
		if s.match != nil && (vx != 0 || vy != 0 || vz != 0) {
			s.match.botRunState = p.Payload[4+28]
		}
	}
	// The client's own send-seq rides in the wrapper's trailing u32 [41:45]; the FIRST one anchors
	// the relay seq (moveBase) — large enough to clear the client's per-pawn seq gate.
	if len(p.Payload) >= 45 && s.moveBase == 0 {
		s.moveBase = binary.LittleEndian.Uint32(p.Payload[41:45])
	}
	if cfg.debugPos {
		log.Printf("[mm-udp] POS cmd=1001 -> (%.1f,%.1f,%.1f)", pos.X, pos.Y, pos.Z)
	}
	// The first cmd 1001 is the earliest packet guaranteed to be AFTER the client's OnSceneLoaded (its
	// pawn must exist to report position), i.e. inside the replay recording window. Re-emit the cmd-101
	// roster ONCE so client replays spawn pawns + dismiss the loading mask. No-op on the live client
	// (idempotent). Runs on run()'s mailbox (cmd 1001 is enqueued once syncStarted). See reseedJoinBurst.
	if s.match != nil {
		s.match.reseedJoinBurst()
	}
}

// handlePlayerQuit handles cmd 191 (RUDP_PLAYER_QUIT_REQ): acknowledge with the quit
// result (cmd 192) and stop the CS sync loop so the server stops streaming GRI/PRI to
// a client that has left the match.
func (s *session) handlePlayerQuit(p *packet.Packet) {
	s.stopped.Store(true)
	s.sendDataLog(packet.CmdPlayerQuitRes, message.PlayerQuit(1), fmt.Sprintf("cmd=192 PlayerQuit payload=%x", p.Payload))
	s.match.clearFlag(s.entityID) // despawn the quitter's flag (it never auto-removes client-side)
	s.match.removePlayer(s)       // drop from the roster; the match keeps running for the others
}

// handleStartRescue handles cmd 142 (RUDP_START_RESCURE): a teammate began reviving a knocked player.
// Payload (LE): [target u32][startMs u64].
func (s *session) handleStartRescue(p *packet.Packet) {
	if len(p.Payload) < 12 {
		return
	}
	target := binary.LittleEndian.Uint32(p.Payload[0:])
	startMs := binary.LittleEndian.Uint64(p.Payload[4:])
	s.match.startRescue(s.entityID, target, startMs)
}

// handleStopRescue handles cmd 143 (RUDP_STOP_RESCURE): the teammate stopped reviving. Payload: [target u32].
func (s *session) handleStopRescue(p *packet.Packet) {
	if len(p.Payload) < 4 {
		return
	}
	target := binary.LittleEndian.Uint32(p.Payload[0:])
	s.match.stopRescue(s.entityID, target)
}

func (s *session) handleConfirmForceSync(p *packet.Packet) {
	if len(p.Payload) < 12 {
		log.Printf("[mm-udp] cmd=146 short force-sync confirmation len=%d", len(p.Payload))
		return
	}
	s.forceSyncEntity = binary.LittleEndian.Uint32(p.Payload[0:4])
	s.forceSyncToken = binary.LittleEndian.Uint32(p.Payload[4:8])
	s.forceSyncRevision = binary.LittleEndian.Uint32(p.Payload[8:12])
	log.Printf("[mm-udp] cmd=146 force-sync confirmed entity=%#x token=%d revision=%d",
		s.forceSyncEntity, s.forceSyncToken, s.forceSyncRevision)
}

func (s *session) handleManualChallenge(p *packet.Packet) {
	if len(p.Payload) < 4 {
		log.Printf("[mm-udp] cmd=280 short manual-challenge len=%d", len(p.Payload))
		return
	}
	id := binary.LittleEndian.Uint32(p.Payload[:4])
	if s.manualChallenges == nil {
		s.manualChallenges = make(map[uint32]uint32)
	}
	s.manualChallenges[id]++
	log.Printf("[mm-udp] cmd=280 manual-challenge id=%d count=%d", id, s.manualChallenges[id])
}

func (s *session) handleManualZoneEnterExit(p *packet.Packet) {
	if len(p.Payload) < 17 {
		log.Printf("[mm-udp] cmd=320 short manual-zone len=%d", len(p.Payload))
		return
	}
	x := int32(binary.LittleEndian.Uint32(p.Payload[0:4]))
	y := int32(binary.LittleEndian.Uint32(p.Payload[4:8]))
	z := int32(binary.LittleEndian.Uint32(p.Payload[8:12]))
	zoneID := binary.LittleEndian.Uint32(p.Payload[12:16])
	entered := p.Payload[16] != 0
	if s.manualZones == nil {
		s.manualZones = make(map[uint32]bool)
	}
	if entered {
		s.manualZones[zoneID] = true
	} else {
		delete(s.manualZones, zoneID)
	}
	log.Printf("[mm-udp] cmd=320 manual-zone id=%d entered=%t pos=(%.3f,%.3f,%.3f)",
		zoneID, entered, float64(x)/1000, float64(y)/1000, float64(z)/1000)
}

func (s *session) handleAddFakeTimes(p *packet.Packet) {
	if len(p.Payload) < 4 {
		log.Printf("[mm-udp] cmd=351 short fake-times len=%d", len(p.Payload))
		return
	}
	delta := binary.LittleEndian.Uint32(p.Payload[:4])
	if ^uint32(0)-s.fakeTimes < delta {
		s.fakeTimes = ^uint32(0)
	} else {
		s.fakeTimes += delta
	}
	log.Printf("[mm-udp] cmd=351 fake-times delta=%d total=%d", delta, s.fakeTimes)
}

// handleUnknown logs an unrecognised packet with its full payload for RE.
func (s *session) handleUnknown(p *packet.Packet) {
	if p.Cmd == packet.CmdSyncServerTime {
		return
	}
	log.Printf("[mm-udp] %v UNHANDLED cmd=%d so=%d seq=%d order=%d flags=%d len=%d payload=%x",
		s.remote, p.Cmd, p.SendOption, p.SeqID, p.OrderID, p.Flags, len(p.Payload), p.Payload)
}

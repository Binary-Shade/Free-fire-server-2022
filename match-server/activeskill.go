package main

import (
	"encoding/binary"
	"fmt"
	"log"
	"time"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

const (
	activeSkillCastDuration = 150 * time.Millisecond
)

type activeSkillSpec struct {
	duration time.Duration
	pulse    time.Duration
	cooldown time.Duration
}

// Server timing policy. These values still need comparison with the client's
// character table; accepting a skill here does not implement all of its effects.
var activeSkills = map[uint32]activeSkillSpec{
	1206: {duration: 10 * time.Second},                                                 // Wukong
	1906: {duration: 300 * time.Millisecond},                                           // A124 (instant conversion)
	2206: {duration: 10 * time.Second, pulse: time.Second, cooldown: 45 * time.Second}, // Alok
	2606: {duration: 10 * time.Second},                                                 // Steffie
	3106: {duration: 7500 * time.Millisecond},                                          // Clu
	3206: {duration: 10 * time.Second},                                                 // Snowelle
	3406: {duration: 2 * time.Second},                                                  // K mode switch
	3606: {duration: 10 * time.Second},                                                 // Sverr
	3806: {duration: 9 * time.Second},                                                  // Chrono
	4006: {duration: 1 * time.Second},                                                  // Skyler (instant projectile)
	4406: {duration: 15 * time.Second},                                                 // Xayne
	4706: {duration: 15 * time.Second},                                                 // Dimitri
}

// activeSkillState is deliberately one activation per player. The 1.70 client
// exposes one active-character button; passive skills never send cmd 244.
type activeSkillState struct {
	skillID     uint32
	syncCmd     uint16
	casting     bool
	effecting   bool
	castingAt   time.Time
	effectAt    time.Time
	effectUntil time.Time
	lastPulse   time.Time
	cooldownEnd time.Time
}

func (s *session) handleUseActiveSkill(p *packet.Packet) {
	if len(p.Payload) != 8 || s.match == nil || s.entityID == 0 {
		return
	}
	playerID := binary.LittleEndian.Uint32(p.Payload[0:4])
	skillID := binary.LittleEndian.Uint32(p.Payload[4:8])
	if playerID != s.entityID || skillID == 0 {
		log.Printf("[mm-udp] active-skill rejected player=%#x skill=%d expected=%#x", playerID, skillID, s.entityID)
		return
	}
	if !hasSkill(s.player.Skills, skillID) {
		log.Printf("[mm-udp] active-skill rejected player=%#x skill=%d equipped=%v", playerID, skillID, s.player.Skills)
		return
	}
	_, known := activeSkills[skillID]
	if !known {
		log.Printf("[mm-udp] active-skill rejected passive/unknown player=%#x skill=%d", playerID, skillID)
		return
	}

	now := time.Now()
	st := &s.activeSkill
	if s.match.lifeOf(s.entityID) != lifeAlive || s.match.hp[s.entityID] == 0 || s.match.ended {
		return
	}
	// A retry while active must never publish StopEffecting: doing so desyncs
	// the client effect from the still-running authoritative healing timer.
	if st.casting || st.effecting {
		return
	}
	if !st.cooldownEnd.IsZero() && now.Before(st.cooldownEnd) {
		// The 1.70 HUD owns the cooldown presentation and press feedback. A retry
		// must not receive another StopEffecting packet: that mutates the client's
		// already-running cooldown/animation state. Reject it without changing the
		// activation timeline; the local HUD keeps its existing cdTime/cdEndTime.
		log.Printf("[mm-udp] active-skill cooldown rejected player=%#x skill=%d remaining=%s",
			s.entityID, skillID, time.Until(st.cooldownEnd).Round(time.Second))
		return
	}

	// The lobby profile stores loadout IDs while the match client sends the
	// resolved runtime ability ID (for example Alok's 2206). Bind this request to
	// the authenticated player's entity instead of comparing incompatible IDs.
	st.skillID = skillID
	st.syncCmd = syncCommandForRequest(p.Cmd)
	st.casting = true
	st.castingAt = now
	st.effectAt = time.Time{}
	st.effectUntil = time.Time{}
	st.lastPulse = time.Time{}
	if spec := activeSkills[skillID]; spec.cooldown > 0 {
		st.cooldownEnd = now.Add(spec.cooldown)
	} else {
		st.cooldownEnd = time.Time{}
	}
	s.match.broadcastData(st.syncCmd,
		s.activeSkillPayload(message.SkillStartCasting, 0, s.match.gameSeconds(now)),
		fmt.Sprintf("cmd=246 active-skill cast player=%#x skill=%d", s.entityID, skillID))
}

func (s *session) handleStopActiveSkill(p *packet.Packet) {
	if len(p.Payload) != 8 || s.match == nil {
		return
	}
	playerID := binary.LittleEndian.Uint32(p.Payload[0:4])
	skillID := binary.LittleEndian.Uint32(p.Payload[4:8])
	if playerID != s.entityID || skillID == 0 || s.activeSkill.skillID != skillID {
		return
	}
	s.stopActiveSkill(time.Now(), "client cancel")
}

func (s *session) stepActiveSkill(now time.Time) {
	st := &s.activeSkill
	if s.match == nil {
		return
	}
	if s.match.lifeOf(s.entityID) != lifeAlive || s.match.hp[s.entityID] == 0 || s.match.ended {
		s.stopActiveSkill(now, "player unavailable")
		return
	}
	if st.casting && !now.Before(st.castingAt.Add(activeSkillCastDuration)) {
		st.casting = false
		st.effecting = true
		st.effectAt = now
		spec := activeSkills[st.skillID]
		st.effectUntil = now.Add(spec.duration)
		st.lastPulse = now
		s.applyActiveSkillStart(st.skillID)
		s.match.broadcastData(st.syncCmd,
			s.activeSkillPayload(message.SkillStartEffecting, s.match.gameSeconds(now), s.match.gameSeconds(st.castingAt)),
			fmt.Sprintf("cmd=246 active-skill effect player=%#x skill=%d", s.entityID, st.skillID))
		return
	}
	if st.effecting {
		spec := activeSkills[st.skillID]
		pulseUntil := now
		if pulseUntil.After(st.effectUntil) {
			pulseUntil = st.effectUntil
		}
		if spec.pulse > 0 && pulseUntil.Sub(st.lastPulse) >= spec.pulse {
			steps := int(pulseUntil.Sub(st.lastPulse) / spec.pulse)
			st.lastPulse = st.lastPulse.Add(time.Duration(steps) * spec.pulse)
			s.applyActiveSkillPulse(st.skillID, steps)
		}
	}
	if st.effecting && !now.Before(st.effectUntil) {
		s.stopActiveSkill(now, "effect elapsed")
	}
}

func (s *session) applyActiveSkillStart(skillID uint32) {
	// A124 converts up to 50 EP into HP immediately. Keeping this authoritative
	// prevents the next PRI update from undoing the client's local conversion.
	if skillID != 1906 || s.ep == 0 {
		return
	}
	hp := s.match.hp[s.entityID]
	if hp >= s.match.settings.maxHP {
		return
	}
	room := s.match.settings.maxHP - hp
	gain := uint16(50)
	if gain > s.ep {
		gain = s.ep
	}
	if gain > room {
		gain = room
	}
	s.ep -= gain
	s.match.hp[s.entityID] = hp + gain
	s.sendVar(packet.CmdPRISync, s.match.priPayload(), 1)
}

func (s *session) applyActiveSkillPulse(skillID uint32, steps int) {
	// Alok heals 5 HP each second while Drop the Beat is active.
	if skillID != 2206 || steps <= 0 || s.match.lifeOf(s.entityID) != lifeAlive {
		return
	}
	hp := s.match.hp[s.entityID]
	if hp >= s.match.settings.maxHP {
		return
	}
	gain := uint16(5 * steps)
	if hp+gain > s.match.settings.maxHP {
		gain = s.match.settings.maxHP - hp
	}
	if gain == 0 {
		log.Printf("[mm-udp] ALOK pulse player=%#x HP=%d/%d (already full)", s.entityID, hp, s.match.settings.maxHP)
		return
	}
	s.match.hp[s.entityID] = hp + gain
	log.Printf("[mm-udp] ALOK pulse player=%#x HP=%d->%d", s.entityID, hp, hp+gain)
	s.sendVar(packet.CmdPRISync, s.match.priPayload(), 1)
}

func (s *session) stopActiveSkill(now time.Time, reason string) {
	st := &s.activeSkill
	if !st.casting && !st.effecting {
		return
	}
	st.casting = false
	st.effecting = false
	// StopEffecting is a new state transition. Its LastEffectTime must advance
	// to the stop instant; repeating the StartEffecting timestamp is stale and
	// later activations can ignore it, leaving the aura attached indefinitely.
	lastEffect := s.match.gameSeconds(now)
	s.match.broadcastData(st.syncCmd,
		s.activeSkillPayload(message.SkillStopEffecting, lastEffect, s.match.gameSeconds(st.castingAt)),
		fmt.Sprintf("cmd=246 active-skill stop player=%#x skill=%d (%s)", s.entityID, st.skillID, reason))
}

func syncCommandForRequest(cmd uint16) uint16 {
	if cmd == packet.CmdUseActiveSkillLegacy || cmd == packet.CmdStopActiveSkillLegacy {
		return packet.CmdSyncActiveSkillLegacy
	}
	return packet.CmdSyncActiveSkill
}

func hasSkill(equipped []uint32, requested uint32) bool {
	for _, skillID := range equipped {
		if skillID == requested {
			return true
		}
	}
	return false
}

func (s *session) activeSkillPayload(state uint32, effectTime, castTime float32) []byte {
	st := &s.activeSkill
	// Both command aliases map to this client's five-field representation.
	return message.ActiveSkillState(s.entityID, st.skillID, state, effectTime, castTime)
}

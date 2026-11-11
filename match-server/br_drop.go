package main

import (
	"fmt"
	"log"
	"time"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

const (
	brDropDuration = 8 * time.Second
	brDropPhysics  = byte(2) // 1.70 client locomotion enum: parachute
)

// startBattleRoyaleDrop places every scene-ready player above the verified
// Bermuda surface and lets the client render its parachute state. The landing
// is emitted by stepBattleRoyaleDrop, so loot and the safe-zone simulation are
// not tied to a guessed aircraft payload.
func (m *Match) startBattleRoyaleDrop(now time.Time) {
	if !m.brDropStartedAt.IsZero() || m.brDropLanded {
		return
	}
	m.brDropStartedAt = now
	for _, p := range m.players {
		if !p.battleSceneReady {
			continue
		}
		battleRoyaleAirSpawn(&p.player)
		p.playerPos = p.player.SpawnPos
		m.tpSeq++
		p.sendDataLog(packet.CmdTeleport,
			message.ForceTeleport(p.entityID, m.tpSeq, p.player.SpawnPos, p.player.SpawnFace, brDropPhysics),
			fmt.Sprintf("cmd=145 BR parachute start ent=%#x height=%.0f", p.entityID, brBattleAirHeight))
	}
	log.Printf("[mm-udp] BR parachute drop started match=%d duration=%v", m.matchID, brDropDuration)
}

func (m *Match) stepBattleRoyaleDrop(now time.Time) {
	if m.brDropStartedAt.IsZero() || m.brDropLanded || now.Sub(m.brDropStartedAt) < brDropDuration {
		return
	}
	m.brDropLanded = true
	for _, p := range m.players {
		if !p.battleSceneReady {
			continue
		}
		battleRoyaleGroundSpawn(&p.player)
		p.playerPos = p.player.SpawnPos
		m.tpSeq++
		p.sendDataLog(packet.CmdTeleport,
			message.ForceTeleport(p.entityID, m.tpSeq, p.player.SpawnPos, p.player.SpawnFace, 0),
			fmt.Sprintf("cmd=145 BR parachute landing ent=%#x pos=(%.1f,%.1f,%.1f)", p.entityID, p.playerPos.X, p.playerPos.Y, p.playerPos.Z))
	}
	log.Printf("[mm-udp] BR parachute drop landed match=%d", m.matchID)
}

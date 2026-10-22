package main

import (
	"time"

	"libmadoka/match-server/packet"
)

func (m *Match) hasEquippedSkill(entity, skillID uint32) bool {
	s := m.sessionByEntity(entity)
	return s != nil && hasSkill(s.player.Skills, skillID)
}

// Ford's level-six Iron Will reduces authoritative safe-zone damage by 24%.
func (m *Match) incomingEnvironmentDamage(entity uint32, damage uint16) uint16 {
	if m.hasEquippedSkill(entity, 306) {
		reduced := uint16((uint32(damage)*76 + 99) / 100)
		if reduced < 1 {
			return 1
		}
		return reduced
	}
	return damage
}

// These effects change server-owned HP/EP, so they must be applied here or a
// later PRI would undo the effect the client displayed locally.
func (m *Match) applyKillPassives(killer uint32) {
	s := m.sessionByEntity(killer)
	if s == nil {
		return
	}
	changed := false
	if hasSkill(s.player.Skills, 1006) { // Miguel: +80 EP per elimination
		s.ep += 80
		if s.ep > maxEP {
			s.ep = maxEP
		}
		s.epLast = time.Now()
		changed = true
	}
	if hasSkill(s.player.Skills, 2906) { // Jota: elimination restores 40 HP
		hp := m.hp[killer]
		if hp < m.settings.maxHP {
			hp += 40
			if hp > m.settings.maxHP {
				hp = m.settings.maxHP
			}
			m.hp[killer] = hp
			changed = true
		}
	}
	if changed {
		s.sendVar(packet.CmdPRISync, m.priPayload(), 1)
	}
}

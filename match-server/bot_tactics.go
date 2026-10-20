package main

import (
	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
	"math"
	"time"
)

func (c botSettings) accuracy() float64 {
	switch c.Difficulty {
	case "easy":
		return .3
	case "hard":
		return .8
	default:
		return .55
	}
}
func (m *Match) botPurchase(b *botAgent) {
	if b == nil || b.purchaseRound == m.round {
		return
	}
	b.purchaseRound = m.round
	if !m.botOptions.Purchasing {
		return
	}
	if m.round <= 1 {
		b.coins = 500
	} else {
		b.coins += 1500
	}
	b.weaponData = 3 // starter USP
	for _, id := range []uint32{12, 7, 10} {
		if item, ok := m.shopItemByID(id); ok && uint32(item.Price) <= b.coins {
			b.coins -= uint32(item.Price)
			b.weaponData = id
			break
		}
	}
	b.glooStock = 0
	if m.botOptions.Gloo {
		if item, ok := m.shopItemByID(1201); ok && uint32(item.Price) <= b.coins {
			b.coins -= uint32(item.Price)
			b.glooStock = 1
		}
	}
}
func (m *Match) botSupport(b *botAgent, now time.Time) bool {
	if m.botOptions.Reviving {
		for _, ally := range m.bots {
			if ally.team != b.team || m.lifeOf(ally.entityID) != lifeKnocked {
				continue
			}
			if math.Hypot(ally.pos.X-b.pos.X, ally.pos.Z-b.pos.Z) > 2.5 || !m.botRouteClear(b.pos, ally.pos) {
				continue
			}
			m.setBotFiring(b, false)
			b.velocity = message.Vec3{}
			m.startRescue(b.entityID, ally.entityID, uint64(time.Since(m.matchStart).Milliseconds()))
			return true
		}
	}
	if m.botOptions.Gloo && b.glooStock > 0 && m.entityHP(b.entityID) < m.settings.maxHP/2 && now.After(b.nextUtility) {
		t := m.sessionByEntity(b.target)
		if t != nil && m.botShotClear(b.pos, t.playerPos) {
			dir := faceToward(b.pos, t.playerPos)
			pos := message.Vec3{X: b.pos.X + dir.X*4, Y: b.pos.Y, Z: b.pos.Z + dir.Z*4}
			if m.botWalkClear(b.pos, pos) {
				m.wallSeq++
				id := wallEntityBase | m.wallSeq
				yaw := math.Atan2(dir.X, dir.Z) / 2
				wall := &iceWall{id: id, repID: id, owner: b.entityID, pos: pos, rot: message.Quat{Y: math.Sin(yaw), W: math.Cos(yaw)}, hp: glooMaxHP, state: wallIntact, placedAt: now}
				m.walls = append(m.walls, wall)
				m.broadcastData(packet.CmdAddIcewall, message.AddIcewall(wall.iceWallState(), 0), "bot defensive gloo")
				b.glooStock--
				b.nextUtility = now.Add(12 * time.Second)
			}
		}
	}
	// Shelter during reload: stay behind nearby cover instead of advancing into fire.
	if m.botOptions.Cover && !b.reloadDone.IsZero() && now.Before(b.reloadDone) {
		t := m.sessionByEntity(b.target)
		if t != nil && !m.botShotClear(b.pos, t.playerPos) {
			b.velocity = message.Vec3{}
			m.setBotFiring(b, false)
			return true
		}
	}
	return false
}

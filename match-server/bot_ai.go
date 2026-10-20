package main

import (
	"encoding/binary"
	"math"
	"math/rand"
	"time"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

// botAgent is authoritative state for a server-controlled pawn. It is updated
// only by Match.run, keeping decisions and gameplay state race-free.
type botAgent struct {
	route         []message.Vec3
	routeAt       time.Time
	coins         uint32
	purchaseRound int
	glooStock     int
	nextUtility   time.Time

	entityID, repID uint32
	slot, team      byte
	pos, velocity   message.Vec3
	face            message.Vec3
	target          uint32
	nextThink       time.Time
	nextShot        time.Time
	reloadDone      time.Time
	burstLeft       int
	magazine        int
	weaponData      uint32
	weaponUnique    uint32
	firing          bool
	moveSeq         uint32
}

const (
	botMoveSpeed   = 4.2
	botStopRange   = 11.0
	botFireRange   = 28.0
	botShotDamage  = 18
	botMagSize     = 30
	botThinkPeriod = 300 * time.Millisecond
	botShotPeriod  = 180 * time.Millisecond
	botReloadTime  = 1800 * time.Millisecond
	botWeaponData  = 12 // SCAR; present in the 1.70 CS shop/data tables
)

func newBotAgent(p joinPlayer, repID uint32, team byte) *botAgent {
	b := &botAgent{entityID: p.EntityID, repID: repID, slot: byte(p.EntityID), team: team}
	b.reset(p)
	return b
}

func (b *botAgent) reset(p joinPlayer) {
	b.pos, b.face = p.SpawnPos, p.SpawnFace
	b.velocity = message.Vec3{}
	b.target = 0
	b.route = nil
	b.routeAt = time.Time{}
	b.magazine = botMagSize
	b.weaponData = botWeaponData
	b.weaponUnique = b.entityID ^ 0x6b000000
	b.firing = false
	b.burstLeft = 0
	b.nextThink, b.nextShot, b.reloadDone = time.Time{}, time.Time{}, time.Time{}
	if b.moveSeq == 0 {
		b.moveSeq = 1800000000 + b.entityID&0xffff
	}
}

func (m *Match) stepBots(now time.Time) {
	for _, b := range m.bots {
		m.stepBot(b, now)
	}
}

func (m *Match) stepBot(b *botAgent, now time.Time) {
	if b == nil || m.botEntity == 0 || m.phase != phFight || m.roundOver || m.lifeOf(b.entityID) != lifeAlive {
		if b != nil {
			m.setBotFiring(b, false)
			b.velocity = message.Vec3{}
		}
		return
	}
	if m.botSupport(b, now) {
		return
	}
	if !b.reloadDone.IsZero() {
		if now.Before(b.reloadDone) {
			m.setBotFiring(b, false)
			return
		}
		b.magazine, b.reloadDone = botMagSize, time.Time{}
	}
	if !now.Before(b.nextThink) {
		b.target = m.botChooseTarget(b)
		b.nextThink = now.Add(botThinkPeriod)
	}
	t := m.sessionByEntity(b.target)
	if t == nil || m.lifeOf(t.entityID) != lifeAlive {
		b.target, b.velocity = 0, message.Vec3{}
		m.setBotFiring(b, false)
		return
	}
	targetPos := t.playerPos
	if targetPos == (message.Vec3{}) {
		targetPos = t.player.SpawnPos
	}
	dx, dz := targetPos.X-b.pos.X, targetPos.Z-b.pos.Z
	dist := math.Hypot(dx, dz)
	blocked := !m.botShotClear(b.pos, targetPos)
	if dist > 0.01 {
		b.face = message.Vec3{X: dx / dist, Z: dz / dist}
	}
	if dist > botStopRange || blocked {
		moveFace := b.face
		if blocked {
			moveFace = m.botNavigate(b, targetPos, now)
			b.face = moveFace
		}
		step := botMoveSpeed * baseTick.Seconds()
		if !blocked && step > dist-botStopRange {
			step = dist - botStopRange
		}
		oldPos := b.pos
		next := m.botMoveWithWallCollision(b.pos, message.Vec3{X: moveFace.X * step, Z: moveFace.Z * step})
		if m.botWalkClear(b.pos, next) {
			b.pos = next
		}
		b.velocity = message.Vec3{X: (b.pos.X - oldPos.X) / baseTick.Seconds(), Z: (b.pos.Z - oldPos.Z) / baseTick.Seconds()}
		m.setBotFiring(b, false)
		return
	}
	b.velocity = message.Vec3{}
	if dist > botFireRange || now.Before(b.nextShot) {
		return
	}
	if b.magazine == 0 {
		m.setBotFiring(b, false)
		b.reloadDone = now.Add(botReloadTime)
		return
	}
	if b.burstLeft == 0 {
		b.burstLeft = 3
	}
	m.setBotFiring(b, true)
	b.magazine--
	b.burstLeft--
	b.nextShot = now.Add(botShotPeriod)
	if m.botShotClear(b.pos, targetPos) && rand.Float64() < m.botOptions.accuracy() {
		m.applyDamage(t.entityID, b.entityID, m.botOptions.shotDamage(), bodyChest)
	}
	if b.burstLeft == 0 {
		b.nextShot = now.Add(450 * time.Millisecond)
		m.setBotFiring(b, false)
	}
}

// botMoveWithWallCollision applies the intended horizontal movement and then
// projects the pawn outside every live gloo-wall footprint. Steering alone is
// insufficient because a discrete tick can cross into the wall before the next
// path decision. The extra radius represents the bot's capsule.
func (m *Match) botMoveWithWallCollision(pos, delta message.Vec3) message.Vec3 {
	next := message.Vec3{X: pos.X + delta.X, Y: pos.Y + delta.Y, Z: pos.Z + delta.Z}
	const wallCollisionRadius = 3.25
	for _, wall := range m.walls {
		if wall == nil || wall.state == wallBroken || wall.hp == 0 || math.Abs(wall.pos.Y-next.Y) > 3.5 {
			continue
		}
		dx, dz := next.X-wall.pos.X, next.Z-wall.pos.Z
		d := math.Hypot(dx, dz)
		if d >= wallCollisionRadius {
			continue
		}
		if d < 0.0001 {
			// Use the previous side when a large correction starts at the centre.
			dx, dz = pos.X-wall.pos.X, pos.Z-wall.pos.Z
			d = math.Hypot(dx, dz)
			if d < 0.0001 {
				dx, dz, d = 0, 1, 1
			}
		}
		next.X = wall.pos.X + dx/d*wallCollisionRadius
		next.Z = wall.pos.Z + dz/d*wallCollisionRadius
	}
	return next
}

// botAvoidanceDirection steers around the nearest live gloo wall intersecting
// the route. The side is stable for a bot/wall pair, preventing oscillation on
// consecutive ticks. A waypoint outside the collision radius makes the bot
// visibly run around cover instead of sliding through it.
func (m *Match) botAvoidanceDirection(b *botAgent, target message.Vec3) message.Vec3 {
	var obstacle *iceWall
	best := math.MaxFloat64
	for _, wall := range m.walls {
		if wall == nil || wall.state == wallBroken || wall.hp == 0 || math.Abs(wall.pos.Y-b.pos.Y) > 3.5 {
			continue
		}
		if pointSegmentDistance2D(wall.pos, b.pos, target) > 2.75 {
			continue
		}
		d := math.Hypot(wall.pos.X-b.pos.X, wall.pos.Z-b.pos.Z)
		if d < best {
			best, obstacle = d, wall
		}
	}
	if obstacle == nil {
		return normalized2D(target.X-b.pos.X, target.Z-b.pos.Z)
	}

	direct := normalized2D(target.X-b.pos.X, target.Z-b.pos.Z)
	side := 1.0
	if (b.entityID^obstacle.id)&1 != 0 {
		side = -1
	}
	const clearance = 4.25
	waypoint := message.Vec3{
		X: obstacle.pos.X - direct.Z*clearance*side,
		Y: b.pos.Y,
		Z: obstacle.pos.Z + direct.X*clearance*side,
	}
	return normalized2D(waypoint.X-b.pos.X, waypoint.Z-b.pos.Z)
}

func normalized2D(x, z float64) message.Vec3 {
	d := math.Hypot(x, z)
	if d < 0.0001 {
		return message.Vec3{}
	}
	return message.Vec3{X: x / d, Z: z / d}
}

// botLineBlocked prevents server-authoritative damage through dynamic cover.
// A gloo wall is approximately five metres wide. Treating its footprint as a
// 2.75m radius is deliberately conservative and also handles curved wall skins.
func (m *Match) botLineBlocked(from, to message.Vec3) bool {
	for _, wall := range m.walls {
		if wall == nil || wall.state == wallBroken || wall.hp == 0 {
			continue
		}
		// Ignore walls on a clearly different floor. Player positions and wall
		// positions are ground anchors, so a generous vertical span is appropriate.
		lineY := (from.Y + to.Y) / 2
		if math.Abs(wall.pos.Y-lineY) > 3.5 {
			continue
		}
		if pointSegmentDistance2D(wall.pos, from, to) <= 2.75 {
			return true
		}
	}
	return false
}

func pointSegmentDistance2D(p, a, b message.Vec3) float64 {
	dx, dz := b.X-a.X, b.Z-a.Z
	den := dx*dx + dz*dz
	if den == 0 {
		return math.Hypot(p.X-a.X, p.Z-a.Z)
	}
	t := ((p.X-a.X)*dx + (p.Z-a.Z)*dz) / den
	if t < 0 {
		t = 0
	} else if t > 1 {
		t = 1
	}
	x, z := a.X+t*dx, a.Z+t*dz
	return math.Hypot(p.X-x, p.Z-z)
}

func (m *Match) botChooseTarget(b *botAgent) uint32 {
	best, bestDist := uint32(0), math.MaxFloat64
	for _, p := range m.players {
		if p.team == b.team || m.lifeOf(p.entityID) != lifeAlive {
			continue
		}
		pos := p.playerPos
		if pos == (message.Vec3{}) {
			pos = p.player.SpawnPos
		}
		d := math.Hypot(pos.X-b.pos.X, pos.Z-b.pos.Z)
		if !m.botShotClear(b.pos, pos) {
			d += 40
		}
		if p.entityID == b.target {
			d -= 3
		}
		if d < bestDist {
			best, bestDist = p.entityID, d
		}
	}
	return best
}

func (m *Match) streamBotMovement(matchTime int32) {
	for _, b := range m.bots {
		m.streamOneBot(b, matchTime)
	}
}
func (m *Match) streamOneBot(b *botAgent, matchTime int32) {
	if b == nil || m.botEntity == 0 || m.lifeOf(b.entityID) == lifeDead {
		return
	}
	b.moveSeq += 3
	entry := message.MoveEntryV2{
		Slot: b.slot, Pos: encodeBotPos(b.pos), Vel: encodeBotVel(b.velocity),
		BodyYaw: yawByte(b.face), AimYaw: yawByte(b.face), MoveState: m.botMoveState(b),
	}
	payload := message.MoveBatchV2(matchTime, b.moveSeq, []message.MoveEntryV2{entry})
	pkt := &packet.Packet{SendOption: packet.SendUnreliable, Cmd: packet.CmdClientPosV2, Payload: payload}
	for _, p := range m.players {
		if p.out != nil {
			p.out.send(pkt, "")
		}
	}
}

func encodeBotPos(v message.Vec3) []byte {
	b := make([]byte, 12)
	binary.LittleEndian.PutUint32(b[0:], uint32(int32(v.X*1000)))
	binary.LittleEndian.PutUint32(b[4:], uint32(int32(v.Y*1000)))
	binary.LittleEndian.PutUint32(b[8:], uint32(int32(v.Z*1000)))
	return b
}

func encodeBotVel(v message.Vec3) []byte {
	b := make([]byte, 6)
	binary.LittleEndian.PutUint16(b[0:], uint16(int16(v.X*100)))
	binary.LittleEndian.PutUint16(b[2:], uint16(int16(v.Y*100)))
	binary.LittleEndian.PutUint16(b[4:], uint16(int16(v.Z*100)))
	return b
}

func (m *Match) botMoveState(b *botAgent) byte {
	if b.velocity.X != 0 || b.velocity.Z != 0 {
		return m.botRunState
	}
	return 0
}

func (m *Match) broadcastBotFire(b *botAgent, start bool) {
	payload := make([]byte, 20)
	binary.LittleEndian.PutUint32(payload[0:], b.entityID)
	binary.LittleEndian.PutUint32(payload[4:], b.weaponUnique)
	binary.LittleEndian.PutUint32(payload[8:], b.moveSeq)
	if start {
		binary.LittleEndian.PutUint32(payload[12:], 2)
		m.broadcastData(packet.CmdWeaponAction, payload, "bot start fire")
		return
	}
	m.broadcastData(packet.CmdStopFire, payload, "bot stop fire")
}

func (m *Match) setBotFiring(b *botAgent, firing bool) {
	if b.firing == firing {
		return
	}
	b.firing = firing
	// PRI field 21 and field 4 must arrive before the edge event, otherwise the
	// old client receives a start-fire event without a usable weapon state.
	if m.s != nil {
		m.s.sendVar(packet.CmdPRISync, m.priPayload(), 1)
	}
	m.broadcastBotFire(b, firing)
}

func (m *Match) syncBotInventory() {
	for _, b := range m.bots {
		m.syncOneBotInventory(b)
	}
}
func (m *Match) syncOneBotInventory(b *botAgent) {
	m.botPurchase(b)
	if b == nil {
		return
	}
	inv := []message.InvItem{{Unique: b.weaponUnique, Data: b.weaponData, Count: 1, Runtime: botMagSize}}
	equip := []message.Equipment{
		{Slot: message.SlotPrimary1, Data: b.weaponData, Unique: b.weaponUnique},
		{Slot: message.SlotMelee},
	}
	m.broadcastData(packet.CmdSyncInventory,
		message.SyncInventory(b.entityID, inv, nil, equip, b.weaponUnique), "bot inventory")
}

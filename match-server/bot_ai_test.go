package main

import (
	"encoding/binary"
	"math"
	"testing"

	"libmadoka/match-server/message"
)

func TestBotMovementEncoding(t *testing.T) {
	p := message.Vec3{X: 12.345, Y: -1.25, Z: 6.75}
	b := encodeBotPos(p)
	if got := int32(binary.LittleEndian.Uint32(b[0:4])); got != 12345 {
		t.Fatalf("x=%d", got)
	}
	if got := int32(binary.LittleEndian.Uint32(b[4:8])); got != -1250 {
		t.Fatalf("y=%d", got)
	}
	if got := int32(binary.LittleEndian.Uint32(b[8:12])); got != 6750 {
		t.Fatalf("z=%d", got)
	}
}

func TestBotChoosesNearestLivingEnemy(t *testing.T) {
	m := &Match{life: map[uint32]lifeState{}}
	a := &session{entityID: 0x01000001, team: 1, playerPos: message.Vec3{X: 20}}
	b := &session{entityID: 0x01000002, team: 1, playerPos: message.Vec3{X: 5}}
	ally := &session{entityID: 0x02000003, team: 2, playerPos: message.Vec3{X: 1}}
	m.players = []*session{a, b, ally}
	m.life[a.entityID], m.life[b.entityID], m.life[ally.entityID] = lifeAlive, lifeAlive, lifeAlive
	bot := &botAgent{entityID: 0x02000004, team: 2}
	if got := m.botChooseTarget(bot); got != b.entityID {
		t.Fatalf("target=%#x want=%#x", got, b.entityID)
	}
	m.life[b.entityID] = lifeDead
	if got := m.botChooseTarget(bot); got != a.entityID {
		t.Fatalf("target after death=%#x want=%#x", got, a.entityID)
	}
}

func TestBotLineBlockedByGloo(t *testing.T) {
	m := &Match{walls: []*iceWall{{
		pos: message.Vec3{X: 5}, hp: 500, state: wallIntact,
	}}}
	from, to := message.Vec3{}, message.Vec3{X: 10}
	if !m.botLineBlocked(from, to) {
		t.Fatal("wall centered on shot line did not block")
	}
	m.walls[0].pos.Z = 4
	if m.botLineBlocked(from, to) {
		t.Fatal("wall away from shot line blocked")
	}
	m.walls[0].pos = message.Vec3{X: 5}
	m.walls[0].state = wallBroken
	if m.botLineBlocked(from, to) {
		t.Fatal("broken wall blocked")
	}
}

func TestBotSteersAroundBlockingGloo(t *testing.T) {
	wall := &iceWall{id: 10, pos: message.Vec3{X: 5}, hp: 500, state: wallIntact}
	m := &Match{walls: []*iceWall{wall}}
	bot := &botAgent{entityID: 2, pos: message.Vec3{}}
	dir := m.botAvoidanceDirection(bot, message.Vec3{X: 10})
	if dir.X <= 0 {
		t.Fatalf("bot did not advance toward target: %+v", dir)
	}
	if dir.Z == 0 {
		t.Fatalf("bot did not steer sideways around wall: %+v", dir)
	}
	if math.Abs(math.Hypot(dir.X, dir.Z)-1) > 0.001 {
		t.Fatalf("direction is not normalized: %+v", dir)
	}
	if got := m.botAvoidanceDirection(bot, message.Vec3{X: 10}); got != dir {
		t.Fatalf("avoidance side oscillated: first=%+v second=%+v", dir, got)
	}
}

func TestBotCannotEnterGlooWall(t *testing.T) {
	wall := &iceWall{id: 10, pos: message.Vec3{X: 5}, hp: 500, state: wallIntact}
	m := &Match{walls: []*iceWall{wall}}

	got := m.botMoveWithWallCollision(message.Vec3{X: 1.8}, message.Vec3{X: 1})
	distance := math.Hypot(got.X-wall.pos.X, got.Z-wall.pos.Z)
	if distance < 3.249 {
		t.Fatalf("bot penetrated wall: pos=%+v distance=%f", got, distance)
	}

	wall.state = wallBroken
	got = m.botMoveWithWallCollision(message.Vec3{X: 1.8}, message.Vec3{X: 1})
	if got.X != 2.8 || got.Z != 0 {
		t.Fatalf("broken wall blocked movement: %+v", got)
	}
}

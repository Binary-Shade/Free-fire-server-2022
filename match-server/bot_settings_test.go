package main

import (
	"libmadoka/match-server/message"
	"math"
	"testing"
)

func TestBotShotBlockedByPermanentWall(t *testing.T) {
	bounds := botBox{Min: v(-50, -10, -50), Max: v(50, 30, 50)}
	m := &Match{arena: csArena{City: "test"}, botOptions: botSettings{Arenas: map[string]botArenaGeometry{"test": {Verified: true, Bounds: bounds, Obstacles: []botBox{{Min: v(4, 0, -2), Max: v(6, 5, 2)}}}}}}
	if m.botShotClear(v(0, 0, 0), v(10, 0, 0)) {
		t.Fatal("shot crossed building wall")
	}
	if !m.botShotClear(v(0, 0, 5), v(10, 0, 5)) {
		t.Fatal("clear shot blocked")
	}
	if !segmentBox(v(5, 1, 0), v(10, 1, 0), botBox{Min: v(4, 0, -2), Max: v(6, 5, 2)}) {
		t.Fatal("shot starting inside a solid was clear")
	}
	m.arena.City = "missing"
	if m.botShotClear(v(0, 0, 5), v(10, 0, 5)) {
		t.Fatal("unknown map allowed damage")
	}
}
func TestBotNavigationAroundBuilding(t *testing.T) {
	m := &Match{arena: csArena{City: "test"}, botOptions: botSettings{Arenas: map[string]botArenaGeometry{"test": {Verified: true, Bounds: botBox{Min: v(-30, -10, -30), Max: v(30, 30, 30)}, Obstacles: []botBox{{Min: v(4, 0, -3), Max: v(6, 6, 3)}}}}}}
	from := v(0, 0, 0)
	path := m.botPath(from, v(12, 0, 0))
	if len(path) == 0 {
		t.Fatal("no path around isolated building")
	}
	for _, p := range path {
		if !m.botWalkClear(from, p) {
			t.Fatalf("path crossed solid from %v to %v", from, p)
		}
		from = p
	}
}
func TestFourBotsSpawnAtOppositeGate(t *testing.T) {
	for _, team := range []byte{1, 2} {
		m := &Match{s: &session{team: team}, arena: csArenas[0], botOptions: botSettings{Opponents: 4}}
		own, _ := m.arena.spawnFor(team - 1)
		m.s.player = joinPlayer{SpawnPos: own}
		ids := map[uint64]bool{}
		positions := map[message.Vec3]bool{}
		for i := 0; i < 4; i++ {
			id := uint32(otherTeam(team))<<24 | uint32(i+2)
			p := m.botSpawn(id, i)
			opp, _ := m.arena.spawnFor(otherTeam(team) - 1)
			if math.Hypot(p.SpawnPos.X-opp.X, p.SpawnPos.Z-opp.Z) > 5 {
				t.Fatal("bot not at enemy gate")
			}
			if math.Hypot(p.SpawnPos.X-own.X, p.SpawnPos.Z-own.Z) < 50 {
				t.Fatal("bot near own gate")
			}
			if ids[p.AccountID] || positions[p.SpawnPos] {
				t.Fatal("duplicate bot identity or position")
			}
			ids[p.AccountID] = true
			positions[p.SpawnPos] = true
		}
	}
}
func TestBotSquadTeamLifecycle(t *testing.T) {
	m := &Match{life: map[uint32]lifeState{}, bots: []*botAgent{{entityID: 0x02000002, team: 2}, {entityID: 0x02000003, team: 2}, {entityID: 0x02000004, team: 2}, {entityID: 0x02000005, team: 2}}}
	if m.teamSize(2) != 4 || m.teamAlive(2) != 4 {
		t.Fatal("squad roster count")
	}
	m.life[0x02000002] = lifeDead
	if m.teamAlive(2) != 3 {
		t.Fatal("one kill incorrectly wiped squad")
	}
	if m.firstAlive(2, 0) == 0 {
		t.Fatal("spectator cannot find surviving bot")
	}
}
func TestExportedMapGeometryLoads(t *testing.T) {
	c := loadBotSettings()
	if len(c.Arenas) != len(csArenas) {
		t.Fatal("missing arena geometry")
	}
	for _, a := range csArenas {
		if len(c.Arenas[a.City].Obstacles) == 0 {
			t.Fatalf("no colliders for %s", a.City)
		}
	}
}
func TestBotArenaSpawnClearance(t *testing.T){
 c:=loadBotSettings()
 for _,a:=range csArenas {m:=&Match{arena:a,botOptions:c};for _,p:=range []message.Vec3{a.Fence0,a.Fence1}{if !m.botWalkClear(p,p){t.Logf("spawn overlaps conservative geometry: %s %v",a.City,p)}}}
}

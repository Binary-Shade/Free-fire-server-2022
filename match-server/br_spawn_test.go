package main

import (
	"encoding/binary"
	"strings"
	"testing"
	"time"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

func TestBattleRoyaleWaitingSpawnUsesExtractedLobbySurface(t *testing.T) {
	saved := cfg.spawn
	cfg.spawn = nil
	t.Cleanup(func() { cfg.spawn = saved })

	pl := joinPlayer{}
	battleRoyaleWaitingSpawn(&pl)
	want := (message.Vec3{X: 0, Y: 14.243206, Z: 0})
	if pl.SpawnPos != want {
		t.Fatalf("spawn=%+v want %+v", pl.SpawnPos, want)
	}
	if pl.SpawnFace != (message.Vec3{X: 0, Y: 0, Z: 1}) {
		t.Fatalf("facing=%+v", pl.SpawnFace)
	}
}

func TestBattleRoyaleGroundSpawnUsesVerifiedSurface(t *testing.T) {
	pl := joinPlayer{}
	battleRoyaleGroundSpawn(&pl)
	want := (message.Vec3{X: 366.6, Y: 15.9, Z: -261.5})
	if pl.SpawnPos != want {
		t.Fatalf("ground spawn=%+v want %+v", pl.SpawnPos, want)
	}
	if pl.SpawnFace != faceToward(want, message.Vec3{X: 477.7, Y: 15.9, Z: -250.6}) {
		t.Fatalf("ground facing=%+v", pl.SpawnFace)
	}
}

func TestBattleRoyaleAirSpawnKeepsVerifiedSurfaceXZ(t *testing.T) {
	pl := joinPlayer{}
	battleRoyaleAirSpawn(&pl)
	if pl.SpawnPos.X != brBattleGroundSpawn.X || pl.SpawnPos.Z != brBattleGroundSpawn.Z {
		t.Fatalf("air spawn=%+v does not align with ground=%+v", pl.SpawnPos, brBattleGroundSpawn)
	}
	if pl.SpawnPos.Y != brBattleAirHeight {
		t.Fatalf("air height=%.2f want %.2f", pl.SpawnPos.Y, brBattleAirHeight)
	}
}

func TestBattleRoyaleStartLeavesWaitingIslandExactlyOnce(t *testing.T) {
	out := &Writer{ch: make(chan outItem, 2)}
	s := &session{out: out, player: joinPlayer{AccountID: 77}}
	m := &Match{players: []*session{s}, matchID: 42, battleRoyale: true}
	s.match = m

	now := time.Unix(100, 0)
	m.startBattleRoyaleSceneLoad(now)
	m.startBattleRoyaleSceneLoad(now.Add(time.Second))

	item := <-out.ch
	if item.pkt.Cmd != packet.CmdBattleStart {
		t.Fatalf("command=%d want %d", item.pkt.Cmd, packet.CmdBattleStart)
	}
	body := item.pkt.Payload
	keyLen := int(binary.LittleEndian.Uint32(body))
	if key := string(body[4 : 4+keyLen]); key != "battle_start_042" {
		t.Fatalf("battle key=%q", key)
	}
	ids := body[4+keyLen:]
	if len(ids) != 16 || binary.LittleEndian.Uint64(ids) != 42 || binary.LittleEndian.Uint64(ids[8:]) != 42 {
		t.Fatalf("room/battle ids=%x", ids)
	}
	if !m.started || !m.battleStartSent || !m.battleStartAt.Equal(now) {
		t.Fatalf("transition state started=%v sent=%v at=%v", m.started, m.battleStartSent, m.battleStartAt)
	}
	select {
	case duplicate := <-out.ch:
		t.Fatalf("duplicate BattleStart queued: %s", strings.TrimSpace(duplicate.label))
	default:
	}
}

func TestClassicSetupDoesNotSelectContraSquadFence(t *testing.T) {
	saved := cfg.spawn
	cfg.spawn = nil
	t.Cleanup(func() { cfg.spawn = saved })

	s := &session{}
	m := &Match{gameMode: 1, battleRoyale: true}
	m.setupMatch(s)

	if m.arena.City != "" {
		t.Fatalf("Classic selected CS arena %q", m.arena.City)
	}
	if s.player.SpawnPos != brWaitingLobbySpawn || s.playerPos != brWaitingLobbySpawn {
		t.Fatalf("player spawn=%+v tracked=%+v want %+v", s.player.SpawnPos, s.playerPos, brWaitingLobbySpawn)
	}
}

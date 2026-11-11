package main

import (
	"testing"

	"libmadoka/match-server/message"
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

package main

import "testing"

func TestFordReducesEnvironmentDamage(t *testing.T) {
	s := &session{entityID: 7, player: joinPlayer{Skills: []uint32{306}}}
	m := &Match{players: []*session{s}}
	if got := m.incomingEnvironmentDamage(7, 10); got != 8 {
		t.Fatalf("Ford zone damage = %d, want 8", got)
	}
	if got := m.incomingEnvironmentDamage(8, 10); got != 10 {
		t.Fatalf("ordinary zone damage = %d, want 10", got)
	}
}

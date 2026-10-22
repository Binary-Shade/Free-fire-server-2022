package main

import "testing"

func TestFallbackBotsDisabledForClashSquadAndCustomRooms(t *testing.T) {
	previous := cfg
	cfg.matchBot = true
	defer func() { cfg = previous }()

	if (&Match{gameMode: 15}).fallbackBotsAllowed() {
		t.Fatal("Clash Squad must never allow fallback bots")
	}
	if (&Match{gameMode: 4, settings: matchSettings{isCustom: true}}).fallbackBotsAllowed() {
		t.Fatal("custom rooms must never allow fallback bots")
	}
	if !(&Match{gameMode: 4}).fallbackBotsAllowed() {
		t.Fatal("explicit diagnostic bots should remain available for non-CS non-custom modes")
	}
}

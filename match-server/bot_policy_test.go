package main

import "testing"

func TestFallbackBotsEnabledForMatchmadeClashSquadOnly(t *testing.T) {
	previous := cfg
	cfg.matchBot = true
	defer func() { cfg = previous }()

	if !(&Match{gameMode: 15}).fallbackBotsAllowed() {
		t.Fatal("matchmade Clash Squad should allow fallback bots when MATCH_BOT is enabled")
	}
	if (&Match{gameMode: 4, settings: matchSettings{isCustom: true}}).fallbackBotsAllowed() {
		t.Fatal("custom rooms must never allow fallback bots")
	}
	if !(&Match{gameMode: 4}).fallbackBotsAllowed() {
		t.Fatal("explicit diagnostic bots should remain available for non-CS non-custom modes")
	}
}

func TestFallbackBotsRequireExplicitConfiguration(t *testing.T) {
	previous := cfg
	cfg.matchBot = false
	defer func() { cfg = previous }()

	if (&Match{gameMode: 15}).fallbackBotsAllowed() {
		t.Fatal("Clash Squad bot fill must remain disabled unless MATCH_BOT is enabled")
	}
}

package main

import (
	"encoding/json"
	"log"
	"time"
)

// fleetHeartbeat keeps this instance registered in the match-server fleet registry so
// the matchmaker can allocate matches to it. addr is the PUBLIC host:port the client
// dials; the registry entry ages out (matchmaker stops picking it) if the heartbeat
// stops — i.e. the instance died. Runs for the life of the process.
func fleetHeartbeat(addr string) {
	for {
		if err := eventBus.RegisterServer(addr, time.Now().Unix()); err != nil {
			log.Printf("[mm-udp] fleet register err: %v", err)
		}
		publishMatchTelemetry(addr)
		time.Sleep(10 * time.Second)
	}
}

func publishMatchTelemetry(addr string) {
	sessionsMu.Lock()
	connected, training, clashSquad := 0, 0, 0
	for _, s := range sessions {
		if !s.syncStarted {
			continue
		}
		connected++
		if s.player.MapID == 7 && s.player.GameMode == 23 {
			training++
		} else {
			clashSquad++
		}
	}
	sessionsMu.Unlock()
	snapshot, _ := json.Marshal(map[string]interface{}{
		"node": cfg.nodeID, "address": addr, "matches": matchManager.count(),
		"players": connected, "training_players": training,
		"clash_squad_players": clashSquad, "updated_at": time.Now().UnixMilli(),
	})
	if err := eventBus.SetTelemetry(cfg.nodeID, string(snapshot), 25*time.Second); err != nil {
		log.Printf("[mm-udp] telemetry err: %v", err)
	}
}

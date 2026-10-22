package main

import (
	"testing"

	"libmadoka/match-server/message"
)

func TestCreateDeathLootBuildsDeadBoxWithDistinctUniques(t *testing.T) {
	s := &session{
		entityID: 0x01000001,
		clientUIDs: map[uint32]lootItem{
			1: {unique: 1, data: 25, count: 1, runtime: 30},
			2: {unique: 2, data: 201, count: 60},
		},
	}
	m := &Match{players: []*session{s}}
	s.match = m
	id, items := m.createDeathLoot(s.entityID, message.Vec3{X: 4, Y: 1, Z: 9}, false)
	if id != runtimeContainerBase || len(items) != 2 {
		t.Fatalf("death box id/items = %d/%d", id, len(items))
	}
	box := m.containers[id]
	if box == nil || box.ctype != message.ContainerDeadBox {
		t.Fatalf("missing dead box: %#v", box)
	}
	seen := map[uint32]bool{}
	for _, item := range items {
		if item.ContainerID != id || item.Unique < 0x70000000 || seen[item.Unique] {
			t.Fatalf("bad death item: %+v", item)
		}
		seen[item.Unique] = true
	}
}

func TestCreateDeathLootSkipsSystemDeaths(t *testing.T) {
	s := &session{entityID: 7, clientUIDs: map[uint32]lootItem{1: {unique: 1, data: 25, count: 1}}}
	m := &Match{players: []*session{s}}
	s.match = m
	id, items := m.createDeathLoot(s.entityID, message.Vec3{}, true)
	if id != 0 || items != nil {
		t.Fatalf("system death created loot: id=%d items=%v", id, items)
	}
}

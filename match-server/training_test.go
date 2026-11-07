package main

import (
	"encoding/binary"
	"testing"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

func TestTrainingCatalogMatchesCapture(t *testing.T) {
	if len(trainingCatalog) != 29 {
		t.Fatalf("entries=%d want 29", len(trainingCatalog))
	}
	for _, id := range []uint32{2, 15, 29, 41, 48} {
		item, ok := trainingItem(id)
		if !ok || item.ItemID != id || item.Ammo == 0 {
			t.Fatalf("catalog item %d unresolved: %#v ok=%v", id, item, ok)
		}
	}
}

func TestTrainingCatalogRequestResponse(t *testing.T) {
	s := &session{entityID: 0x0d00000d, out: &Writer{ch: make(chan outItem, 2)}}
	s.match = &Match{training: true}
	payload := make([]byte, 8)
	binary.LittleEndian.PutUint32(payload, s.entityID)
	binary.LittleEndian.PutUint32(payload[4:], trainingCatalogID)
	s.handleTrainingCatalogReq(&packet.Packet{Cmd: packet.CmdTrainingCatalogReq, Payload: payload})
	item := <-s.out.ch
	if item.pkt.Cmd != packet.CmdTrainingCatalog || len(item.pkt.Payload) != 387 {
		t.Fatalf("response cmd/len=%d/%d", item.pkt.Cmd, len(item.pkt.Payload))
	}
}

func TestTrainingShopTriggerPushesShopOnlyOnStateChange(t *testing.T) {
	s := &session{entityID: 0x01000001, out: &Writer{ch: make(chan outItem, 4)}}
	s.match = &Match{training: true}
	payload := make([]byte, 9)
	binary.LittleEndian.PutUint32(payload, s.entityID)
	binary.LittleEndian.PutUint32(payload[4:], 1001)
	payload[8] = 1

	pkt := &packet.Packet{Cmd: packet.CmdTrainingEnterShop, Payload: payload}
	s.handleTrainingTrigger(pkt)
	catalog := <-s.out.ch
	if catalog.pkt.Cmd != packet.CmdTrainingShowShop || len(catalog.pkt.Payload) != 9 ||
		binary.LittleEndian.Uint32(catalog.pkt.Payload[4:8]) != 1001 || catalog.pkt.Payload[8] != 1 {
		t.Fatalf("bad pushed catalog cmd=%d payload=%x", catalog.pkt.Cmd, catalog.pkt.Payload)
	}
	s.handleTrainingTrigger(pkt)
	select {
	case duplicate := <-s.out.ch:
		t.Fatalf("duplicate trigger echoed: cmd=%d", duplicate.pkt.Cmd)
	default:
	}
}

func TestTrainingWorldInitTeleportsToCapturedSpawn(t *testing.T) {
	s := &session{entityID: 0x0d00000d, out: &Writer{ch: make(chan outItem, 4)}}
	m := &Match{training: true}
	s.match = m
	m.sendTrainingWorldInit(s)
	ready := <-s.out.ch
	tp := <-s.out.ch
	world := <-s.out.ch
	if ready.pkt.Cmd != packet.CmdTrainingReady || tp.pkt.Cmd != packet.CmdTeleport || world.pkt.Cmd != packet.CmdTrainingWorldReady {
		t.Fatalf("commands=%d,%d,%d", ready.pkt.Cmd, tp.pkt.Cmd, world.pkt.Cmd)
	}
	if len(tp.pkt.Payload) != 37 {
		t.Fatalf("teleport length=%d", len(tp.pkt.Payload))
	}
	x := int32(binary.LittleEndian.Uint32(tp.pkt.Payload[8:12]))
	y := int32(binary.LittleEndian.Uint32(tp.pkt.Payload[12:16]))
	z := int32(binary.LittleEndian.Uint32(tp.pkt.Payload[16:20]))
	if x != 63250 || y != 11513 || z != 16430 {
		t.Fatalf("teleport mm=(%d,%d,%d)", x, y, z)
	}
}

func TestTrainingSelectionAcknowledgesAndEquipsWeapon(t *testing.T) {
	s := &session{
		entityID: 0x0d00000d,
		out:      &Writer{ch: make(chan outItem, 32)},
		weapons:  map[byte]csWeapon{},
		player:   joinPlayer{EntityID: 0x0d00000d},
	}
	m := &Match{
		training:   true,
		players:    []*session{s},
		containers: map[uint16]*container{},
		hp:         map[uint32]uint16{s.entityID: 200},
		life:       map[uint32]lifeState{s.entityID: lifeAlive},
	}
	s.match = m
	payload := make([]byte, 12)
	binary.LittleEndian.PutUint32(payload, s.entityID)
	binary.LittleEndian.PutUint32(payload[4:], 15) // MP40 from the captured catalogue
	binary.LittleEndian.PutUint32(payload[8:], 1)
	s.handleTrainingSelectItem(&packet.Packet{Cmd: packet.CmdTrainingSelectItem, Payload: payload})

	ack := <-s.out.ch
	inv := <-s.out.ch
	if ack.pkt.Cmd != packet.CmdTrainingItemGranted || binary.LittleEndian.Uint32(ack.pkt.Payload[4:]) != 15 {
		t.Fatalf("bad selection ack cmd=%d payload=%x", ack.pkt.Cmd, ack.pkt.Payload)
	}
	if inv.pkt.Cmd != packet.CmdSyncInventory {
		t.Fatalf("second packet cmd=%d want inventory", inv.pkt.Cmd)
	}
	weapon, ok := s.weapons[message.SlotPrimary1]
	if !ok || weapon.data != 15 || s.itemOnHand != weapon.unique {
		t.Fatalf("MP40 not equipped: weapon=%+v hand=%d", weapon, s.itemOnHand)
	}
}

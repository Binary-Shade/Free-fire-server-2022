package main

import (
	"encoding/binary"
	"fmt"
	"log"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

const trainingCatalogID uint32 = 1001

// PVP_AlphaIsland/PlayerSpawnRegion from the shipped level41 scene.
// The rotation quaternion (y=.9452064, w=.3264733) faces southeast.
var trainingSpawn = message.Vec3{X: 63.25, Y: 11.513, Z: 16.43}
var trainingFacing = message.Vec3{X: 0.617, Z: -0.787}

// Alpha Island's vehicle loop is centred around these level41 reset markers.
// They are also safe, grounded destinations for the inventory-shop portal.
var trainingPortalSpawn = message.Vec3{X: 47.84, Y: 8.66, Z: -22.2}
var trainingPortalFacing = message.Vec3{X: 0, Z: 1}

var trainingCatalog = []message.TrainingCatalogEntry{
	{2, 1, 101, true}, {6, 2, 101, true}, {12, 3, 101, true}, {24, 4, 101, true},
	{33, 5, 101, true}, {11, 6, 101, true}, {14, 7, 101, true}, {28, 8, 101, true},
	{46, 9, 101, true}, {47, 10, 101, true}, {48, 11, 101, true}, {18, 14, 101, true},
	{19, 15, 101, true}, {30, 16, 101, true},
	{4, 1, 102, true}, {21, 2, 102, true}, {13, 4, 102, true}, {26, 5, 102, true},
	{10, 1, 103, true}, {25, 2, 103, true}, {9, 3, 103, true},
	{8, 1, 104, true}, {7, 2, 104, true}, {15, 3, 104, true}, {43, 4, 104, true}, {32, 6, 104, true},
	{5, 1, 105, true}, {41, 2, 105, true}, {29, 3, 105, true},
}

func trainingItem(itemID uint32) (*message.ShopItem, bool) {
	for _, entry := range trainingCatalog {
		if entry.ItemID != itemID || !entry.Enabled {
			continue
		}
		ammo := weaponAmmo[itemID]
		if ammo == 0 {
			switch entry.Category {
			case 101:
				ammo = 201 // rifles
			case 102:
				ammo = 203 // snipers
			case 103:
				ammo = 202 // pistols
			case 104:
				ammo = 205 // SMGs
			case 105:
				ammo = 204 // shotguns
			}
		}
		if ammo == 0 {
			return nil, false
		}
		slotKind := "primary"
		if ammo == 202 {
			slotKind = "secondary"
		}
		return &message.ShopItem{ItemID: itemID, Filter: 1, Ammo: ammo, SlotKind: slotKind}, true
	}
	return nil, false
}

func (m *Match) sendTrainingWorldInit(s *session) {
	s.sendDataLog(packet.CmdTrainingReady, nil, "cmd=587 TrainingReady")
	m.tpSeq++
	s.sendDataLog(packet.CmdTeleport,
		message.ForceTeleport(s.entityID, m.tpSeq, trainingSpawn, trainingFacing, 0),
		fmt.Sprintf("cmd=145 Training teleport ent=%#x token=%d pos=(%.2f,%.2f,%.2f)", s.entityID, m.tpSeq, trainingSpawn.X, trainingSpawn.Y, trainingSpawn.Z))
	s.sendDataLog(packet.CmdTrainingWorldReady, nil, "cmd=253 TrainingWorldReady")
	m.sendTrainingGroundState(s)
}

// sendTrainingGroundState publishes the static training pickups once and replays
// them to a reconnecting client. The client uses the normal world-loot path for
// these objects, so cmd 111 pickup works identically to dropped loot.
func (m *Match) sendTrainingGroundState(s *session) {
	if m.containers == nil {
		m.containers = make(map[uint16]*container)
	}
	if !m.trainingSeeded {
		m.trainingSeeded = true
		id := uint16(41000)
		for i, entry := range trainingCatalog {
			item, ok := trainingItem(entry.ItemID)
			if !ok {
				continue
			}
			// Spread the catalogue along the marked vehicle loop so the client
			// sees a usable training rack rather than a single overlapping pile.
			pos := message.Vec3{X: 48 + float64(i%8)*8, Y: 8.66, Z: -22 + float64(i/8)*8}
			unique := uint32(0x71000000) | uint32(i+1)
			m.containers[id] = &container{id: id, pos: pos, ctype: message.ContainerNormal, items: []lootItem{{unique: unique, data: item.ItemID, count: 1}}}
			id++
		}
		// Utility rack: ammo, healing, armour, and gloo are ordinary ground
		// inventory objects, so the existing pickup/equip path handles them.
		utilities := []struct {
			data uint32
			pos  message.Vec3
		}{
			{201, message.Vec3{X: 48, Y: 8.66, Z: 18}},
			{203, message.Vec3{X: 56, Y: 8.66, Z: 18}},
			{102, message.Vec3{X: 64, Y: 8.66, Z: 18}},
			{302, message.Vec3{X: 72, Y: 8.66, Z: 18}},
			{305, message.Vec3{X: 80, Y: 8.66, Z: 18}},
			{1201, message.Vec3{X: 88, Y: 8.66, Z: 18}},
		}
		for _, utility := range utilities {
			m.containers[id] = &container{id: id, pos: utility.pos, ctype: message.ContainerNormal, items: []lootItem{{unique: 0x71010000 | uint32(id), data: utility.data, count: 1}}}
			id++
		}
	}
	for _, box := range m.containers {
		if box == nil || len(box.items) == 0 || box.ctype != message.ContainerNormal {
			continue
		}
		for _, item := range box.items {
			// Alpha Island's 1.70 client does not materialise the list-form
			// pickup packet (cmd 225) for this scene. The same client does
			// render and interact with the single-item world packet used by
			// Bermuda, so emit cmd 114 per object.
			s.sendDataLog(packet.CmdAddPickup, message.AddPickup(item.pickupItem(box.id), box.pos, box.ctype),
				fmt.Sprintf("cmd=114 Training pickup box=%d data=%d", box.id, item.data))
		}
	}
}

func (s *session) handleTrainingCatalogReq(p *packet.Packet) {
	if s.match == nil || !s.match.training || len(p.Payload) < 8 {
		return
	}
	playerID := binary.LittleEndian.Uint32(p.Payload[:4])
	if playerID != s.entityID {
		return
	}
	// In this build cmd 326 is RUDP_TRAINING_REQUESTADDINVENTORY and
	// carries [entity,item,qty]. Keep the 8-byte legacy catalogue request
	// for older clients that use 326 -> 316.
	if len(p.Payload) >= 12 {
		s.handleTrainingAddInventory(p)
		return
	}
	catalogID := binary.LittleEndian.Uint32(p.Payload[4:8])
	if catalogID != trainingCatalogID {
		log.Printf("[mm-udp] cmd=326 invalid Training catalogue request player=%#x catalog=%d", playerID, catalogID)
		return
	}
	s.sendDataLog(packet.CmdTrainingCatalog,
		message.TrainingCatalog(s.entityID, trainingCatalogID, trainingCatalog),
		fmt.Sprintf("cmd=316 Training catalogue entries=%d", len(trainingCatalog)))
}

func (s *session) handleTrainingAddInventory(p *packet.Packet) {
	itemID := binary.LittleEndian.Uint32(p.Payload[4:8])
	qty := binary.LittleEndian.Uint32(p.Payload[8:12])
	if qty == 0 {
		qty = 1
	}
	item, ok := trainingItem(itemID)
	if !ok {
		log.Printf("[mm-udp] cmd=326 unknown Training inventory item=%d", itemID)
		return
	}
	before := s.equipSnapshot()
	inv, attach, equip, outgoing, attachEquips := s.addPurchasedItem(item, qty)
	s.sendDataLog(packet.CmdTrainingBuySuccess, message.TrainingItemGranted(s.entityID, itemID),
		fmt.Sprintf("cmd=324 Training inventory success data=%d", itemID))
	s.match.broadcastData(packet.CmdSyncInventory,
		message.SyncInventory(s.entityID, inv, attach, equip, s.itemOnHand),
		fmt.Sprintf("cmd=174 Training inventory data=%d", itemID))
	s.sendAttachEquips(attachEquips)
	s.broadcastEquipDiff(before)
	if len(outgoing) > 0 {
		s.dropOverriddenAfterEquip(outgoing)
	}
}

// handleTrainingTrigger handles the scene's server-authoritative Training
// triggers. This 1.70 client sends cmd 334 while entering an inventory-shop
// volume. Command 323 is RUDP_TRAINING_SHOWSHOPLIST in the 1.70 opcode table;
// later revisions use different command numbers, so do not send their command
// 316 catalogue message to this client.
//
// Wire: [u32 entity][u32 trigger/catalog id][u8 active]. The client repeats an
// active overlap every physics tick, so acknowledge only state changes.
func (s *session) handleTrainingTrigger(p *packet.Packet) {
	if s.match == nil || !s.match.training || len(p.Payload) < 9 {
		return
	}
	entityID := binary.LittleEndian.Uint32(p.Payload[:4])
	triggerID := binary.LittleEndian.Uint32(p.Payload[4:8])
	active := p.Payload[8] != 0
	if entityID != s.entityID {
		return
	}
	if s.trainingTriggers == nil {
		s.trainingTriggers = make(map[uint64]bool)
	}
	key := uint64(p.Cmd)<<32 | uint64(triggerID)
	if previous, exists := s.trainingTriggers[key]; exists && previous == active {
		return
	}
	s.trainingTriggers[key] = active
	if p.Cmd == packet.CmdTrainingEnterShop && active {
		s.sendDataLog(packet.CmdTrainingShowShop,
			message.TrainingShowShop(s.entityID, triggerID, true),
			fmt.Sprintf("cmd=323 Training show shop trigger=%d active=true", triggerID))
		return
	}
	if p.Cmd == packet.CmdTrainingIntoPortal {
		if active {
			s.match.tpSeq++
			s.player.SpawnPos, s.player.SpawnFace = trainingPortalSpawn, trainingPortalFacing
			s.playerPos = trainingPortalSpawn
			s.sendDataLog(packet.CmdTeleport,
				message.ForceTeleport(s.entityID, s.match.tpSeq, trainingPortalSpawn, trainingPortalFacing, 0),
				fmt.Sprintf("cmd=145 Training portal ent=%#x id=%d pos=(%.2f,%.2f,%.2f)", entityID, triggerID, trainingPortalSpawn.X, trainingPortalSpawn.Y, trainingPortalSpawn.Z))
			s.sendDataLog(packet.CmdTrainingWorldReady, nil, "cmd=253 TrainingWorldReady portal")
		}
	}
}

func (s *session) handleTrainingSelectItem(p *packet.Packet) {
	if s.match == nil || !s.match.training || len(p.Payload) < 12 {
		return
	}
	playerID := binary.LittleEndian.Uint32(p.Payload[:4])
	itemID := binary.LittleEndian.Uint32(p.Payload[4:8])
	qty := binary.LittleEndian.Uint32(p.Payload[8:12])
	if playerID != s.entityID {
		return
	}
	if qty == 0 {
		qty = 1
	}
	item, ok := trainingItem(itemID)
	if !ok {
		log.Printf("[mm-udp] cmd=318 unknown Training item=%d", itemID)
		return
	}

	before := s.equipSnapshot()
	inv, attach, equip, outgoing, attachEquips := s.addPurchasedItem(item, qty)
	s.sendDataLog(packet.CmdTrainingItemGranted, message.TrainingItemGranted(s.entityID, itemID),
		fmt.Sprintf("cmd=317 Training item granted data=%d", itemID))
	s.match.broadcastData(packet.CmdSyncInventory,
		message.SyncInventory(s.entityID, inv, attach, equip, s.itemOnHand),
		fmt.Sprintf("cmd=174 Training inventory data=%d", itemID))
	s.sendAttachEquips(attachEquips)
	s.broadcastEquipDiff(before)
	if len(outgoing) > 0 {
		s.dropOverriddenAfterEquip(outgoing)
	}
}

func (s *session) handleTrainingRespawn(p *packet.Packet) {
	if s.match == nil || !s.match.training || len(p.Payload) < 4 {
		return
	}
	if binary.LittleEndian.Uint32(p.Payload[:4]) != s.entityID {
		return
	}
	s.player.SpawnPos, s.player.SpawnFace = trainingSpawn, trainingFacing
	s.playerPos = trainingSpawn
	s.match.hp[s.entityID] = s.match.settings.maxHP
	s.match.life[s.entityID] = lifeAlive
	s.match.sendTrainingWorldInit(s)
}

func (s *session) handleTrainingStatus(p *packet.Packet) {
	if s.match == nil || !s.match.training || len(p.Payload) < 4 || binary.LittleEndian.Uint32(p.Payload[:4]) != s.entityID {
		return
	}
	// A status acknowledgement keeps the client-side interaction state alive.
	s.sendDataLog(packet.CmdTrainingStatus, append([]byte(nil), p.Payload[:minInt(len(p.Payload), 8)]...), "cmd=319 Training status")
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *session) handleTrainingInit(p *packet.Packet) {
	if s.match != nil && s.match.training {
		log.Printf("[mm-udp] cmd=301 Training preset (%dB): %x", len(p.Payload), p.Payload)
	}
}

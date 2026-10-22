package main

import (
	"encoding/binary"
	"math"
	"testing"
	"time"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

func TestRetryCannotStopActiveSkill(t *testing.T) {
	s := &session{entityID: 1, player: joinPlayer{Skills: []uint32{2206}}}
	s.match = &Match{hp: map[uint32]uint16{1: 100}, players: []*session{s}}
	s.out = &Writer{ch: make(chan outItem, 10)}
	s.activeSkill = activeSkillState{skillID: 2206, effecting: true, cooldownEnd: time.Now().Add(time.Minute)}
	payload := make([]byte, 8)
	binary.LittleEndian.PutUint32(payload, 1)
	binary.LittleEndian.PutUint32(payload[4:], 2206)
	s.handleUseActiveSkill(&packet.Packet{Cmd: packet.CmdUseActiveSkill, Payload: payload})
	if !s.activeSkill.effecting || len(s.out.ch) != 0 {
		t.Fatal("retry changed active effect or emitted a stop")
	}
}

func TestCooldownPressDoesNotMutateClientSkillState(t *testing.T) {
	s := &session{entityID: 1, player: joinPlayer{Skills: []uint32{2206}}}
	s.match = &Match{hp: map[uint32]uint16{1: 100}, players: []*session{s}}
	s.out = &Writer{ch: make(chan outItem, 10)}
	s.activeSkill = activeSkillState{skillID: 2206, cooldownEnd: time.Now().Add(time.Minute)}
	payload := make([]byte, 8)
	binary.LittleEndian.PutUint32(payload, 1)
	binary.LittleEndian.PutUint32(payload[4:], 2206)
	s.handleUseActiveSkill(&packet.Packet{Cmd: packet.CmdUseActiveSkill, Payload: payload})
	if s.activeSkill.casting || s.activeSkill.effecting || len(s.out.ch) != 0 {
		t.Fatal("cooldown press started an effect or emitted a duplicate state")
	}
}

func TestHasSkill(t *testing.T) {
	if !hasSkill([]uint32{2206, 406}, 2206) {
		t.Fatal("equipped active skill was rejected")
	}
	if hasSkill([]uint32{406}, 2206) {
		t.Fatal("unequipped active skill was accepted")
	}
}

func TestActiveSkillCatalogDoesNotTreatPassiveAsActive(t *testing.T) {
	if alok, ok := activeSkills[2206]; !ok {
		t.Fatal("Alok missing from active catalog")
	} else if alok.duration != 10*time.Second || alok.cooldown != 45*time.Second || alok.pulse != time.Second {
		t.Fatalf("bad Alok timings: %+v", alok)
	}
	if _, ok := activeSkills[1406]; ok {
		t.Fatal("Moco passive was classified as active")
	}
	if _, ok := activeSkills[2506]; ok {
		t.Fatal("Kelly awakened passive was classified as active")
	}
}

func TestActiveSkillProtocolFamily(t *testing.T) {
	if got := syncCommandForRequest(packet.CmdUseActiveSkillLegacy); got != packet.CmdSyncActiveSkillLegacy {
		t.Fatalf("legacy sync cmd = %d", got)
	}
	if got := syncCommandForRequest(packet.CmdUseActiveSkill); got != packet.CmdSyncActiveSkill {
		t.Fatalf("current sync cmd = %d", got)
	}
}

func TestActiveSkillPayloadUsesClientTwentyByteLayout(t *testing.T) {
	s := &session{entityID: 0x01000001}
	s.activeSkill = activeSkillState{skillID: 2206, syncCmd: packet.CmdSyncActiveSkill}
	p := s.activeSkillPayload(2, 12.5, 2.25)
	if len(p) != 20 {
		t.Fatalf("active skill payload length = %d, want 20", len(p))
	}
	if got := binary.LittleEndian.Uint32(p[0:4]); got != s.entityID {
		t.Fatalf("player = %#x", got)
	}
	if got := binary.LittleEndian.Uint32(p[4:8]); got != 2206 {
		t.Fatalf("skill = %d", got)
	}
	if got := binary.LittleEndian.Uint32(p[8:12]); got != 2 {
		t.Fatalf("state = %d", got)
	}
	if got := math.Float32frombits(binary.LittleEndian.Uint32(p[12:16])); got != 12.5 {
		t.Fatalf("last effect time = %f", got)
	}
	if got := math.Float32frombits(binary.LittleEndian.Uint32(p[16:20])); got != 2.25 {
		t.Fatalf("last casting time = %f", got)
	}
}

func TestCasterAndRemoteReceiveCompleteActiveSkillLifecycle(t *testing.T) {
	caster := &session{entityID: 1, player: joinPlayer{Skills: []uint32{2206}}}
	remote := &session{entityID: 2}
	caster.out = &Writer{ch: make(chan outItem, 10)}
	remote.out = &Writer{ch: make(chan outItem, 10)}
	m := &Match{
		matchStart: time.Now().Add(-time.Second),
		hp:         map[uint32]uint16{1: 100, 2: 100},
		life:       map[uint32]lifeState{1: lifeAlive, 2: lifeAlive},
		players:    []*session{caster, remote},
	}
	caster.match, remote.match = m, m

	payload := make([]byte, 8)
	binary.LittleEndian.PutUint32(payload, caster.entityID)
	binary.LittleEndian.PutUint32(payload[4:], 2206)
	caster.handleUseActiveSkill(&packet.Packet{Cmd: packet.CmdUseActiveSkill, Payload: payload})
	if got := len(caster.out.ch); got != 1 {
		t.Fatalf("caster received %d casting packets, want 1", got)
	}
	if got := len(remote.out.ch); got != 1 {
		t.Fatalf("remote received %d casting packets, want 1", got)
	}
	cast := <-remote.out.ch
	if state := binary.LittleEndian.Uint32(cast.pkt.Payload[8:12]); state != message.SkillStartCasting {
		t.Fatalf("remote casting state=%d", state)
	}
	if state := binary.LittleEndian.Uint32((<-caster.out.ch).pkt.Payload[8:12]); state != message.SkillStartCasting {
		t.Fatalf("caster casting state=%d", state)
	}

	caster.stepActiveSkill(caster.activeSkill.castingAt.Add(activeSkillCastDuration))
	if got := len(caster.out.ch); got != 1 {
		t.Fatalf("caster received %d effect packets, want 1", got)
	}
	if state := binary.LittleEndian.Uint32((<-caster.out.ch).pkt.Payload[8:12]); state != message.SkillStartEffecting {
		t.Fatalf("caster effect state=%d", state)
	}
	if got := len(remote.out.ch); got != 1 {
		t.Fatalf("remote received %d effect packets, want 1", got)
	}
	effect := <-remote.out.ch

	caster.stopActiveSkill(caster.activeSkill.effectUntil, "test elapsed")
	if got := len(caster.out.ch); got != 1 {
		t.Fatalf("caster received %d stop packets, want 1", got)
	}
	if state := binary.LittleEndian.Uint32((<-caster.out.ch).pkt.Payload[8:12]); state != message.SkillStopEffecting {
		t.Fatalf("caster stop state=%d", state)
	}
	if got := len(remote.out.ch); got != 1 {
		t.Fatalf("remote received %d stop packets, want 1", got)
	}
	stop := <-remote.out.ch
	if state := binary.LittleEndian.Uint32(stop.pkt.Payload[8:12]); state != message.SkillStopEffecting {
		t.Fatalf("remote stop state=%d", state)
	}
	stopTime := math.Float32frombits(binary.LittleEndian.Uint32(stop.pkt.Payload[12:16]))
	effectTime := math.Float32frombits(binary.LittleEndian.Uint32(effect.pkt.Payload[12:16]))
	if stopTime <= effectTime {
		t.Fatalf("stop timestamp %f did not advance past effect timestamp %f", stopTime, effectTime)
	}
}

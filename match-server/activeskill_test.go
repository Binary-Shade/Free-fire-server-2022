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

func TestActiveSkillPayloadUsesCurrentThirtyByteLayout(t *testing.T) {
	s := &session{entityID: 0x01000001}
	s.activeSkill = activeSkillState{skillID: 2206, syncCmd: packet.CmdSyncActiveSkill, castSeconds: 12.5, effectEndSeconds: 22.5, cooldownEndMS: 57500}
	p := s.activeSkillPayload(2, 12.5, 2.25)
	if len(p) != 30 {
		t.Fatalf("active skill payload length = %d, want 30", len(p))
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
		t.Fatalf("cast time = %f", got)
	}
	if got := binary.LittleEndian.Uint32(p[16:20]); got != 57500 {
		t.Fatalf("cooldown end ms = %d", got)
	}
	if got := math.Float32frombits(binary.LittleEndian.Uint32(p[24:28])); got != 22.5 {
		t.Fatalf("effect end time = %f", got)
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
	// The legacy family retains its staged 20-byte lifecycle.
	caster.handleUseActiveSkill(&packet.Packet{Cmd: packet.CmdUseActiveSkillLegacy, Payload: payload})
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

func TestCurrentAlokPublishesCapturedStateSequenceAndDeadlines(t *testing.T) {
	caster := &session{entityID: 0x01000001, player: joinPlayer{Skills: []uint32{2206}}}
	remote := &session{entityID: 0x02000001}
	caster.out = &Writer{ch: make(chan outItem, 10)}
	remote.out = &Writer{ch: make(chan outItem, 10)}
	start := time.Now().Add(-50 * time.Second)
	m := &Match{
		matchStart: start,
		hp:         map[uint32]uint16{caster.entityID: 100, remote.entityID: 100},
		life:       map[uint32]lifeState{caster.entityID: lifeAlive, remote.entityID: lifeAlive},
		players:    []*session{caster, remote},
	}
	caster.match, remote.match = m, m
	payload := make([]byte, 8)
	binary.LittleEndian.PutUint32(payload, caster.entityID)
	binary.LittleEndian.PutUint32(payload[4:], 2206)
	caster.handleUseActiveSkill(&packet.Packet{Cmd: packet.CmdUseActiveSkill, Payload: payload})

	if got := len(caster.out.ch); got != 3 {
		t.Fatalf("caster received %d initial packets, want 3", got)
	}
	if got := len(remote.out.ch); got != 3 {
		t.Fatalf("remote received %d initial packets, want 3", got)
	}
	var initialStop []byte
	for i, want := range []uint32{message.SkillStopEffecting, message.SkillStartCasting, message.SkillStartEffecting} {
		item := <-caster.out.ch
		if item.pkt.Cmd != packet.CmdSyncActiveSkill || len(item.pkt.Payload) != 30 {
			t.Fatalf("packet %d cmd/length = %d/%d", i, item.pkt.Cmd, len(item.pkt.Payload))
		}
		if got := binary.LittleEndian.Uint32(item.pkt.Payload[8:12]); got != want {
			t.Fatalf("packet %d state = %d, want %d", i, got, want)
		}
		if i == 0 {
			initialStop = append([]byte(nil), item.pkt.Payload...)
		}
	}
	for i := 0; i < 3; i++ {
		<-remote.out.ch
	}

	cast := math.Float32frombits(binary.LittleEndian.Uint32(initialStop[12:16]))
	cooldownEnd := binary.LittleEndian.Uint32(initialStop[16:20])
	effectEnd := math.Float32frombits(binary.LittleEndian.Uint32(initialStop[24:28]))
	if math.Abs(float64(effectEnd-cast-10)) > 0.01 {
		t.Fatalf("effect deadline delta = %f, want 10", effectEnd-cast)
	}
	if math.Abs(float64(cooldownEnd)-float64(cast*1000+45000)) > 2 {
		t.Fatalf("cooldown deadline = %d, cast=%f", cooldownEnd, cast)
	}

	caster.stepActiveSkill(caster.activeSkill.effectUntil)
	if got := len(caster.out.ch); got != 1 {
		t.Fatalf("expiry packets = %d, want 1", got)
	}
	expired := (<-caster.out.ch).pkt.Payload
	if string(expired) != string(initialStop) {
		t.Fatalf("expiry state differs from captured initial stop state\n%x\n%x", expired, initialStop)
	}
	<-remote.out.ch

	caster.stepActiveSkill(caster.activeSkill.cooldownEnd)
	if got := len(caster.out.ch); got != 1 {
		t.Fatalf("cooldown-ready packets = %d, want 1", got)
	}
	ready := (<-caster.out.ch).pkt.Payload
	if len(ready) != 30 || binary.LittleEndian.Uint32(ready[8:12]) != message.SkillCooldownReady {
		t.Fatalf("bad cooldown-ready payload: %x", ready)
	}
	for i, b := range ready[12:] {
		if b != 0 {
			t.Fatalf("cooldown-ready timing byte %d is nonzero: %x", i, ready)
		}
	}
	caster.stepActiveSkill(caster.activeSkill.cooldownEnd.Add(time.Second))
	if got := len(caster.out.ch); got != 0 {
		t.Fatalf("cooldown-ready repeated %d times", got)
	}
}

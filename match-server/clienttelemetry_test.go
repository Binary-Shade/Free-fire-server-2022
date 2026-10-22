package main

import (
	"encoding/binary"
	"testing"

	"libmadoka/match-server/packet"
)

func TestClientTelemetryCommands(t *testing.T) {
	s := &session{}
	confirm := make([]byte, 12)
	binary.LittleEndian.PutUint32(confirm[0:4], 0x01000001)
	binary.LittleEndian.PutUint32(confirm[4:8], 0x6adb6dea)
	binary.LittleEndian.PutUint32(confirm[8:12], 5)
	s.route(&packet.Packet{Cmd: packet.CmdConfirmForceSync, Payload: confirm})
	if s.forceSyncEntity != 0x01000001 || s.forceSyncToken != 0x6adb6dea || s.forceSyncRevision != 5 {
		t.Fatalf("force sync confirmation decoded incorrectly: %#x %d %d", s.forceSyncEntity, s.forceSyncToken, s.forceSyncRevision)
	}

	challenge := make([]byte, 4)
	binary.LittleEndian.PutUint32(challenge, 20007)
	s.route(&packet.Packet{Cmd: packet.CmdManualChallenge, Payload: challenge})
	s.route(&packet.Packet{Cmd: packet.CmdManualChallenge, Payload: challenge})
	if s.manualChallenges[20007] != 2 {
		t.Fatalf("challenge count=%d", s.manualChallenges[20007])
	}

	zone := make([]byte, 17)
	binary.LittleEndian.PutUint32(zone[12:16], 1007)
	zone[16] = 1
	s.route(&packet.Packet{Cmd: packet.CmdManualZoneEnterExit, Payload: zone})
	if !s.manualZones[1007] {
		t.Fatal("zone enter was not stored")
	}
	zone[16] = 0
	s.route(&packet.Packet{Cmd: packet.CmdManualZoneEnterExit, Payload: zone})
	if s.manualZones[1007] {
		t.Fatal("zone exit was not stored")
	}

	fake := make([]byte, 4)
	binary.LittleEndian.PutUint32(fake, 2)
	s.route(&packet.Packet{Cmd: packet.CmdAddFakeTimesReq, Payload: fake})
	if s.fakeTimes != 2 {
		t.Fatalf("fake times=%d", s.fakeTimes)
	}
}

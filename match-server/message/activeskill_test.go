package message

import (
	"encoding/binary"
	"math"
	"testing"
)

func TestActiveSkill170ClientLayout(t *testing.T) {
	b := ActiveSkillStateCurrent(1, 2206, 2, 12.5, 57500, 0, 22.5, nil)
	// GPBEINJKAFN.UnSerialize reads seven 32-bit values and a signed short count.
	if len(b) != 30 {
		t.Fatalf("client needs 30 bytes minimum, got %d", len(b))
	}
	if binary.LittleEndian.Uint32(b[16:]) != 57500 {
		t.Fatal("cooldown deadline missing")
	}
	if binary.LittleEndian.Uint32(b[20:]) != 0 {
		t.Fatal("wrong phase")
	}
	if math.Float32frombits(binary.LittleEndian.Uint32(b[24:])) != 22.5 {
		t.Fatal("effect deadline missing")
	}
	if binary.LittleEndian.Uint16(b[28:]) != 0 {
		t.Fatal("wrong pending phase count")
	}
}

func TestActiveSkillState(t *testing.T) {
	b := ActiveSkillState(0x01000001, 2206, SkillStartEffecting, 12.5, 9.25)
	if len(b) != 20 {
		t.Fatalf("length = %d, want 20", len(b))
	}
	if got := binary.LittleEndian.Uint32(b[0:]); got != 0x01000001 {
		t.Fatalf("player id = %#x", got)
	}
	if got := binary.LittleEndian.Uint32(b[4:]); got != 2206 {
		t.Fatalf("skill id = %d", got)
	}
	if got := binary.LittleEndian.Uint32(b[8:]); got != SkillStartEffecting {
		t.Fatalf("state = %d", got)
	}
	if got := math.Float32frombits(binary.LittleEndian.Uint32(b[12:])); got != 12.5 {
		t.Fatalf("effect time = %v", got)
	}
	if got := math.Float32frombits(binary.LittleEndian.Uint32(b[16:])); got != 9.25 {
		t.Fatalf("casting time = %v", got)
	}
}

package message

import (
	"bytes"
	"encoding/binary"
	"testing"
)

// TestPlayerJoinIdentity checks that PlayerJoin encodes the identity at the head
// of OGJKHJAFNHB (u64 account id | u64 | u32 entity | i32 name-len + name), so
// wiring cosmetics later can't silently corrupt the fields the client keys on.
func TestPlayerJoinIdentity(t *testing.T) {
	pi := PlayerInfo{AccountID: 10000001, EntityID: 1, Name: "foices"}
	b := PlayerJoin(pi, 0)

	if got := binary.LittleEndian.Uint64(b[0:8]); got != pi.AccountID {
		t.Fatalf("account id = %d, want %d", got, pi.AccountID)
	}
	if got := binary.LittleEndian.Uint32(b[16:20]); got != pi.EntityID {
		t.Fatalf("entity id = %d, want %d", got, pi.EntityID)
	}
	nameLen := int(binary.LittleEndian.Uint32(b[20:24]))
	if nameLen != len(pi.Name) || string(b[24:24+nameLen]) != pi.Name {
		t.Fatalf("name = %q (len %d), want %q", b[24:24+nameLen], nameLen, pi.Name)
	}
}

// TestPlayerJoinStableWithoutCosmetics documents the known-good baseline length
// (cosmetics unset ⇒ all-zero PKPAMKEDCDC). If this changes, the join wire
// format changed — make sure the client still accepts it.
func TestPlayerJoinStableWithoutCosmetics(t *testing.T) {
	b := PlayerJoin(PlayerInfo{AccountID: 10000001, EntityID: 1, Name: "foices"}, 0)
	const wantLen = 234 // verified accepted live (see UDP_MATCH_PROTOCOL.md)
	if len(b) != wantLen {
		t.Fatalf("PlayerJoin len = %d, want %d (baseline changed — reverify with the client)", len(b), wantLen)
	}
}

func TestU32List(t *testing.T) {
	var w Writer
	w.U32List([]uint32{203000001, 211000000})
	want := []byte{0x02, 0x00} // int16 count = 2
	want = binary.LittleEndian.AppendUint32(want, 203000001)
	want = binary.LittleEndian.AppendUint32(want, 211000000)
	if !bytes.Equal(w.B, want) {
		t.Fatalf("U32List = % x, want % x", w.B, want)
	}
}

func TestPlayerProfileEncodesCharacterSkills(t *testing.T) {
	var w Writer
	w.pkpamkedcdc(PlayerInfo{
		Avatar: 102000024, Color: 5,
		Clothes: []uint32{203000001},
		Skills:  []uint32{3806, 406},
	})
	off := 8 // avatar + skin color
	clothCount := int(binary.LittleEndian.Uint16(w.B[off : off+2]))
	off += 2 + clothCount*4
	if got := binary.LittleEndian.Uint16(w.B[off : off+2]); got != 2 {
		t.Fatalf("skill count = %d, want 2", got)
	}
	off += 2
	if got := binary.LittleEndian.Uint32(w.B[off : off+4]); got != 3806 {
		t.Fatalf("active skill = %d, want 3806", got)
	}
	if got := binary.LittleEndian.Uint32(w.B[off+4 : off+8]); got != 406 {
		t.Fatalf("passive skill = %d, want 406", got)
	}
}

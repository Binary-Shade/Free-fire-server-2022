package message

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"testing"
)

func TestDefaultRegionActivitiesMatchesTrainingCapture(t *testing.T) {
	want := "01000700000044454641554c545500000068747470733a2f2f6769746875622e636f6d2f66697374736b696e66662d626565702f706e67666f7266666c6f672f72656c65617365732f646f776e6c6f61642f66662f313738323930393536373131382e706e670000000000000000000000000000000000"
	got := SyncRegionActivitiesDefault()
	if len(got) != 119 || fmt.Sprintf("%x", got) != want {
		t.Fatalf("default region payload len=%d hex=%x", len(got), got)
	}
}

func TestTrainingCatalogCapturedLayout(t *testing.T) {
	entries := []TrainingCatalogEntry{{ItemID: 15, Index: 3, Category: 104, Enabled: true}}
	b := TrainingCatalog(0x0d00000d, 1001, entries)
	if len(b) != 23 {
		t.Fatalf("length=%d want 23", len(b))
	}
	if binary.LittleEndian.Uint32(b[0:4]) != 0x0d00000d || binary.LittleEndian.Uint32(b[4:8]) != 1001 {
		t.Fatalf("bad header: %x", b[:8])
	}
	if binary.LittleEndian.Uint16(b[8:10]) != 1 || binary.LittleEndian.Uint32(b[10:14]) != 15 || b[22] != 1 {
		t.Fatalf("bad entry: %x", b[8:])
	}
}

func TestTrainingGRIMatchesCapture(t *testing.T) {
	want := []byte{0x0b, 0x00, 0x03, 0x00, 0x01, 0x00, 0x03, 0x01, 0x00, 0x00, 0x01, 0x02, 0x00}
	if got := TrainingGRI(); !bytes.Equal(got, want) {
		t.Fatalf("Training GRI=%x want %x", got, want)
	}
}

func TestTrainingControlPayloads(t *testing.T) {
	if got := TrainingItemGranted(7, 41); len(got) != 8 || binary.LittleEndian.Uint32(got[4:]) != 41 {
		t.Fatalf("item granted=%x", got)
	}
	if got := TrainingJoinFinished(0x01000001); len(got) != 4 || binary.LittleEndian.Uint32(got) != 0x01000001 {
		t.Fatalf("join finished=%x", got)
	}
}

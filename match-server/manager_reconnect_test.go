package main

import (
	"encoding/binary"
	"testing"
)

func TestManagerResumeRequiresMatchingAccountAndMatch(t *testing.T) {
	old := &session{player: joinPlayer{AccountID: 101, MatchID: 7001}}
	m := &Match{
		players: []*session{old},
		matchID: 7001,
		mailbox: make(chan func(), 4),
		done:    make(chan struct{}, 1),
	}
	old.match = m
	mgr := &MatchManager{matches: []MatchHandle{m}, factory: localFactory{}}

	wrongAccount := &session{player: joinPlayer{AccountID: 202, MatchID: 7001}}
	if mgr.resume(wrongAccount) {
		t.Fatal("different account reclaimed an existing pawn")
	}
	wrongMatch := &session{player: joinPlayer{AccountID: 101, MatchID: 8001}}
	if mgr.resume(wrongMatch) {
		t.Fatal("different match reclaimed an existing pawn")
	}

	incoming := &session{player: joinPlayer{AccountID: 101, MatchID: 7001}}
	if !mgr.resume(incoming) {
		t.Fatal("matching signed identity was not accepted for reconnect")
	}
	if got := len(m.mailbox); got != 1 {
		t.Fatalf("resume must serialize takeover on match loop; mailbox=%d", got)
	}
}

func TestReconnectKeyParsesOpaqueSessionIdentity(t *testing.T) {
	key := "0123456789abcdef0123456789abcdef"
	payload := binary.LittleEndian.AppendUint32(nil, uint32(len(key)))
	payload = append(payload, key...)
	if got := reconnectKey(payload); got != key {
		t.Fatalf("reconnect key=%q, want %q", got, key)
	}
	if got := reconnectKey([]byte{99, 0, 0, 0}); got != "" {
		t.Fatalf("malformed reconnect key accepted: %q", got)
	}
	if a, b := newSessionKey(), newSessionKey(); a == "" || a == b {
		t.Fatalf("session keys must be non-empty and unique: %q %q", a, b)
	}
}

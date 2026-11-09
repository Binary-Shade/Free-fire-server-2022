package main

import (
	"log"
	"sync"
)

// maxPlayers caps a CS match's roster at the user's 8-player limit; the minimum of 2 comes for
// free because a lone human always has the enemy bot for company. The MatchManager enforces the
// cap when routing a joining player (Step 4b wires the routing; until Step 5 there is only ever
// one human per match, so the cap is not yet exercised).
const maxPlayers = 8

// MatchManager owns every live Match in the process and routes a joining player to one: an
// existing match with a free slot, else a fresh match. Step 4b introduces it as the central
// registry (the match list was implicit in main.go's sessions map before); Step 5 uses join()
// to drop a second player into an existing match; Step 7 reaps finished matches from it.
//
// mu guards the match list. It is touched from the receive goroutine at join/registration time,
// NEVER from a match's run() loop (a match never reaches across to another), so it never
// contends with the lock-free single-owner model inside a match.
type MatchManager struct {
	mu      sync.Mutex
	matches []MatchHandle
	factory MatchFactory
}

// matchManager is the process-wide registry. It mints matches through the factory (localFactory ships
// in-process today) and only ever handles them as MatchHandle — the process seam (Step 8, matchhandle.go).
var matchManager = &MatchManager{factory: localFactory{}}

// join routes a joining human to a match — an existing one with a free slot, else a fresh one — and
// admits them. m.reserved (manager-owned under mu) is the race-safe roster-size view; run() owns
// m.players. The first player of a fresh match runs admitFirst inline (which starts run()); a later
// player's admit is enqueued onto the already-running match loop, and its inbound handlers are routed
// to that mailbox from now on (syncStarted).
func (mgr *MatchManager) join(s *session) {
	mgr.mu.Lock()
	var h MatchHandle
	for _, cand := range mgr.matches {
		if cand.canAdmit(s) { // the requested match/mode has a free slot and hasn't ended
			h = cand
			break
		}
	}
	fresh := h == nil
	if fresh {
		h = mgr.factory.create(s) // no room anywhere -> mint a new match (localFactory: in-process)
		mgr.matches = append(mgr.matches, h)
	}
	h.reserve()
	mgr.mu.Unlock()

	h.admit(s, fresh) // wire the player in (fresh starts run(); a later player enqueues onto its loop)
}

// resume reattaches a new UDP transport to an existing player. Match id and
// account id are both read from the signed prepare token. The old session is
// retained because it owns that player's inventory, entity ids and skill state.
func (mgr *MatchManager) resume(in *session) bool {
	mgr.mu.Lock()
	var m *Match
	var old *session
	for _, h := range mgr.matches {
		cand, ok := h.(*Match)
		if !ok || cand.ended || cand.matchID == 0 || cand.matchID != in.player.MatchID {
			continue
		}
		for _, p := range cand.players {
			if p.player.AccountID == in.player.AccountID {
				m, old = cand, p
				break
			}
		}
		if old != nil {
			break
		}
	}
	mgr.mu.Unlock()
	if old == nil {
		return false
	}
	old.enqueue(func() { m.resumePlayer(old, in) })
	log.Printf("[mm-udp] reconnect accepted uid=%d match=%d old=%v new=%v",
		in.player.AccountID, in.player.MatchID, old.remote, in.remote)
	return true
}

// reap removes a finished match from the registry — called from its run() goroutine on exit. It's a
// brief, once-per-match lock, so it doesn't contend with the hot single-owner path inside a match.
func (mgr *MatchManager) reap(m MatchHandle) {
	mgr.mu.Lock()
	defer mgr.mu.Unlock()
	kept := mgr.matches[:0]
	for _, cand := range mgr.matches {
		if cand != m {
			kept = append(kept, cand)
		}
	}
	mgr.matches = kept
}

// count returns the number of live matches (diagnostics / future reaping).
func (mgr *MatchManager) count() int {
	mgr.mu.Lock()
	defer mgr.mu.Unlock()
	return len(mgr.matches)
}

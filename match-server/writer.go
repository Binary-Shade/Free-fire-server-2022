package main

import (
	"encoding/binary"
	"log"
	"net"
	"strings"
	"time"

	"libmadoka/match-server/packet"
)

// RUDP retransmission tuning. A reliable (so=2) send is buffered until the client ACKs
// its seq; if the ACK doesn't arrive within rudpRTO it is resent (same bytes / seq, so the
// client de-dupes by seq) with bounded backoff for rudpReliableLife. The client ACKs each reliable packet
// individually (cmd 2, payload [seq u16][ackBits u32]) — the server used to IGNORE those,
// so a dropped death/inventory/teleport was lost forever.
const (
	rudpRTO          = 250 * time.Millisecond
	rudpMaxRTO       = 2 * time.Second
	rudpTick         = 50 * time.Millisecond
	rudpReliableLife = 20 * time.Second
)

// Writer is one connection's outbound path. A single goroutine (run) owns the seq/order
// counters, the retransmit buffer, and every WriteToUDP for this remote, so senders never
// take a lock — they just enqueue. Framing in one place is also the fan-out primitive the
// multiplayer broadcast is built on: a match hands the same pre-framed VAR bytes to every
// player's Writer.
type Writer struct {
	conn *net.UDPConn
	addr *net.UDPAddr
	key  []byte
	ch   chan outItem
	acks chan ackFrame // client ACK windows routed here from the receive loop; drained by run()

	// Owned SOLELY by run(): the reliable sequence counter (shared by hello + reliable data),
	// the send_option=2 data order counter, and the un-ACKed reliable-send buffer. No mutex —
	// run() is the only mutator.
	seq     uint16
	order   uint16
	pending map[uint16]*pendingPkt
}

// ackFrame is the rolling acknowledgement carried by cmd 2. Bit zero acknowledges
// base-1, bit one base-2, and so on, allowing out-of-order delivery without needless resends.
type ackFrame struct {
	base uint16
	bits uint32
}

// pendingPkt is an un-ACKed reliable send held for retransmit: the fully-framed wire bytes
// (resent verbatim, keeping the same seq so the client de-dupes), the next resend deadline,
// and how many times it has been resent.
type pendingPkt struct {
	label     string
	wire      []byte
	firstSent time.Time
	deadline  time.Time
	retries   int
}

// outItem is one queued send: either a pre-encoded packet emitted verbatim (raw — e.g. an ack)
// or a logical packet the Writer frames with this connection's next seq/order.
type outItem struct {
	pkt   *packet.Packet
	raw   []byte
	label string
}

// newWriter starts a Writer and its run() goroutine for the given remote.
func newWriter(conn *net.UDPConn, addr *net.UDPAddr, key []byte) *Writer {
	w := &Writer{
		conn:    conn,
		addr:    addr,
		key:     key,
		ch:      make(chan outItem, 256),
		acks:    make(chan ackFrame, 256),
		pending: map[uint16]*pendingPkt{},
	}
	go w.run()
	return w
}

// run is the sole owner of seq/order, the socket, and the retransmit buffer for this remote.
// It frames + sends each queued item (FIFO), removes ACKed packets from the buffer, and resends
// un-ACKed reliable packets whose RTO elapsed — all on one goroutine, so no lock is needed.
func (w *Writer) run() {
	t := time.NewTicker(rudpTick)
	defer t.Stop()
	for {
		select {
		case it, ok := <-w.ch:
			if !ok {
				return
			}
			w.emit(it)
		case ack := <-w.acks:
			if p := w.pending[ack.base]; p != nil && strings.Contains(p.label, "active-skill") {
				log.Printf("[mm-udp] skill ACK seq=%d peer=%v %s", ack.base, w.addr, p.label)
			}
			w.applyAck(ack)
		case now := <-t.C:
			w.retransmit(now)
		}
	}
}

// emit frames + sends one queued item, stamping seq/order for reliable packets and buffering
// ordered reliable data (so=2) for retransmit until the client ACKs its seq.
func (w *Writer) emit(it outItem) {
	if it.pkt == nil { // pre-encoded (ack): emit verbatim
		if it.raw != nil {
			if _, err := w.conn.WriteToUDP(it.raw, w.addr); err != nil {
				log.Printf("[mm-udp] write err: %v", err)
			}
		}
		return
	}
	if packet.IsReliable(it.pkt.Cmd, it.pkt.SendOption) { // hello (so=1) + reliable data (so=2)
		it.pkt.SeqID = w.seq
		w.seq++
		if it.pkt.SendOption == packet.SendReliable { // only ordered data carries an order id
			it.pkt.OrderID = w.order
			w.order++
		}
	}
	wire, err := it.pkt.Encode(w.key)
	if err != nil {
		log.Printf("[mm-udp] encode cmd=%d err: %v", it.pkt.Cmd, err)
		return
	}
	if _, err := w.conn.WriteToUDP(wire, w.addr); err != nil {
		log.Printf("[mm-udp] write err: %v", err)
	}
	// Buffer ordered reliable data (so=2) for retransmit. HELLO (so=1) is a one-shot handshake;
	// VAR/unreliable carry no seq, so they aren't retransmittable.
	if it.pkt.SendOption == packet.SendReliable {
		now := time.Now()
		w.pending[it.pkt.SeqID] = &pendingPkt{wire: wire, firstSent: now, deadline: now.Add(rudpRTO), label: it.label}
	}
	if it.label != "" {
		log.Printf("[mm-udp] -> %s (seq=%d order=%d %dB) %v", it.label, it.pkt.SeqID, it.pkt.OrderID, len(it.pkt.Payload), w.addr)
	}
}

// retransmit resends every buffered reliable packet whose RTO has elapsed (same bytes/seq),
// dropping any that remains unacknowledged for rudpReliableLife (the client is gone or will reconnect).
func (w *Writer) retransmit(now time.Time) {
	for seq, p := range w.pending {
		if now.Before(p.deadline) {
			continue
		}
		if now.Sub(p.firstSent) >= rudpReliableLife {
			delete(w.pending, seq)
			log.Printf("[mm-udp] retransmit gave up on seq=%d after %s (%d tries) %v",
				seq, rudpReliableLife, p.retries, w.addr)
			continue
		}
		if _, err := w.conn.WriteToUDP(p.wire, w.addr); err != nil {
			log.Printf("[mm-udp] retransmit err: %v", err)
		}
		p.retries++
		backoff := rudpRTO << min(p.retries, 3)
		if backoff > rudpMaxRTO {
			backoff = rudpMaxRTO
		}
		p.deadline = now.Add(backoff)
	}
}

// onAck routes a client ACK (of one of our reliable seqs) to run(). Non-blocking: a full
// buffer just delays the ACK, so the packet retransmits once more (harmless — client de-dupes).
func (w *Writer) onAck(base uint16, bits uint32) {
	select {
	case w.acks <- ackFrame{base: base, bits: bits}:
	default:
	}
}

func (w *Writer) applyAck(ack ackFrame) {
	delete(w.pending, ack.base)
	for bit := uint(0); bit < 32; bit++ {
		if ack.bits&(uint32(1)<<bit) != 0 {
			delete(w.pending, ack.base-uint16(bit+1))
		}
	}
}

// send queues a logical packet; run() assigns its seq/order (if reliable), frames, and sends it,
// logging `label` with the assigned seq/order when non-empty.
func (w *Writer) send(p *packet.Packet, label string) {
	w.ch <- outItem{pkt: p, label: label}
}

// sendRaw queues a pre-encoded packet (e.g. an ack) to emit verbatim.
func (w *Writer) sendRaw(raw []byte) {
	w.ch <- outItem{raw: raw}
}

// frameVar encodes an unreliable VAR packet (send_option=4, plaintext, no seq/order) ONCE.
// VAR framing carries no per-connection state, so the resulting bytes are identical for every
// recipient — this is what lets a match encode a PRI/GRI tick once and fan the SAME slice to all
// players (the key is unused for a plaintext VAR, but Encode takes it). Returns nil on error.
func frameVar(cmd uint16, payload, key []byte) []byte {
	wire, err := (&packet.Packet{SendOption: packet.SendVar, Cmd: cmd, Flags: 0, Payload: payload}).Encode(key)
	if err != nil {
		log.Printf("[mm-udp] frameVar cmd=%d err: %v", cmd, err)
		return nil
	}
	return wire
}

// broadcast enqueues the SAME pre-framed bytes to every recipient Writer (verbatim). Used for the
// VAR replication streams (900/901/1000) whose bytes are identical for all players.
func broadcast(wire []byte, outs []*Writer) {
	if wire == nil {
		return
	}
	for _, out := range outs {
		out.sendRaw(wire)
	}
}

// parseAckSeq extracts the ACKed reliable seq from a client cmd-2 ACK payload
// ([seq u16][ackBits u32], plaintext). Returns false if the payload is too short.
func parseAck(payload []byte) (ackFrame, bool) {
	if len(payload) < 2 {
		return ackFrame{}, false
	}
	a := ackFrame{base: binary.LittleEndian.Uint16(payload)}
	if len(payload) >= 6 {
		a.bits = binary.LittleEndian.Uint32(payload[2:6])
	}
	return a, true
}

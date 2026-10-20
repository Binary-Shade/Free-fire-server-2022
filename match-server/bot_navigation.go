package main

import (
	"container/heap"
	"libmadoka/match-server/message"
	"math"
	"time"
)

type botNavNode struct {
	x, z   int
	g, f   float64
	parent *botNavNode
}
type botNavQueue []*botNavNode

func (q botNavQueue) Len() int           { return len(q) }
func (q botNavQueue) Less(i, j int) bool { return q[i].f < q[j].f }
func (q botNavQueue) Swap(i, j int)      { q[i], q[j] = q[j], q[i] }
func (q *botNavQueue) Push(v any)        { *q = append(*q, v.(*botNavNode)) }
func (q *botNavQueue) Pop() any          { v := (*q)[len(*q)-1]; *q = (*q)[:len(*q)-1]; return v }
func (m *Match) botRouteClear(a, b message.Vec3) bool {
	return m.botWalkClear(a, b) && !m.botLineBlocked(a, b)
}

// Bounded A* searches a 2m horizontal grid at the pawn's current elevation.
// Routes are cached per pawn; no teleporting or walking through an unknown cell.
func (m *Match) botPath(from, to message.Vec3) []message.Vec3 {
	if m.botRouteClear(from, to) {
		return []message.Vec3{to}
	}
	const cell = 2.0
	start := &botNavNode{}
	q := &botNavQueue{start}
	heap.Init(q)
	best := map[[2]int]float64{{0, 0}: 0}
	point := func(n *botNavNode) message.Vec3 {
		return message.Vec3{X: from.X + float64(n.x)*cell, Y: from.Y, Z: from.Z + float64(n.z)*cell}
	}
	for expanded := 0; q.Len() > 0 && expanded < 3000; expanded++ {
		n := heap.Pop(q).(*botNavNode)
		p := point(n)
		if n.g > best[[2]int{n.x, n.z}] {
			continue
		}
		if math.Hypot(p.X-to.X, p.Z-to.Z) < 3 && m.botRouteClear(p, to) {
			path := []message.Vec3{to}
			for n.parent != nil {
				path = append(path, point(n))
				n = n.parent
			}
			for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
				path[i], path[j] = path[j], path[i]
			}
			return path
		}
		for dx := -1; dx <= 1; dx++ {
			for dz := -1; dz <= 1; dz++ {
				if dx == 0 && dz == 0 {
					continue
				}
				v := &botNavNode{x: n.x + dx, z: n.z + dz, parent: n}
				dest := point(v)
				if !m.botRouteClear(p, dest) {
					continue
				}
				v.g = n.g + math.Hypot(float64(dx), float64(dz))*cell
				k := [2]int{v.x, v.z}
				if old, ok := best[k]; ok && old <= v.g {
					continue
				}
				best[k] = v.g
				v.f = v.g + math.Hypot(dest.X-to.X, dest.Z-to.Z)
				heap.Push(q, v)
			}
		}
	}
	return nil
}
func (m *Match) botNavigate(b *botAgent, target message.Vec3, now time.Time) message.Vec3 {
	if m.botRouteClear(b.pos, target) {
		b.route = nil
		return normalized2D(target.X-b.pos.X, target.Z-b.pos.Z)
	}
	if now.After(b.routeAt) {
		b.route = m.botPath(b.pos, target)
		b.routeAt = now.Add(2 * time.Second)
	}
	for len(b.route) > 0 && math.Hypot(b.pos.X-b.route[0].X, b.pos.Z-b.route[0].Z) < 0.5 {
		b.route = b.route[1:]
	}
	if len(b.route) == 0 {
		return message.Vec3{}
	}
	if !m.botRouteClear(b.pos, b.route[0]) {
		b.route = nil
		return message.Vec3{}
	}
	return normalized2D(b.route[0].X-b.pos.X, b.route[0].Z-b.pos.Z)
}

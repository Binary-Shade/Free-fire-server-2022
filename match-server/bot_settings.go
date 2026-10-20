package main

import (
	"encoding/json"
	"libmadoka/match-server/message"
	"log"
	"math"
	"os"
	"path/filepath"
)

type botBox struct {
	Min message.Vec3 `json:"min"`
	Max message.Vec3 `json:"max"`
}
type botArenaGeometry struct {
	grid      map[[2]int][]botBox
	Verified  bool     `json:"verified"`
	Bounds    botBox   `json:"bounds"`
	Obstacles []botBox `json:"obstacles"`
}
type botSettings struct {
	Purchasing bool                        `json:"purchasing"`
	Cover      bool                        `json:"cover"`
	Reviving   bool                        `json:"reviving"`
	Gloo       bool                        `json:"gloo"`
	Opponents  int                         `json:"opponents"`
	Difficulty string                      `json:"difficulty"`
	Arenas     map[string]botArenaGeometry `json:"arenas"`
}

func loadBotSettings() botSettings {
	c := botSettings{Opponents: 4, Difficulty: "normal", Purchasing: true, Cover: true, Reviving: true, Gloo: true, Arenas: map[string]botArenaGeometry{}}
	path := os.Getenv("BOT_SETTINGS_FILE")
	if path == "" {
		path = filepath.Join("data", "bot-settings.json")
		if _, e := os.Stat("data"); e != nil {
			path = filepath.Join("..", path)
		}
	}
	if data, err := os.ReadFile(path); err == nil {
		if err = json.Unmarshal(data, &c); err != nil {
			log.Printf("[bots] invalid settings: %v", err)
			c = botSettings{Opponents: 4, Difficulty: "normal"}
		}
	}
	if c.Opponents < 1 || c.Opponents > 4 {
		c.Opponents = 4
	}
	loadBotGeometry(&c, filepath.Join(filepath.Dir(path), "bot-geometry.json"))
	return c
}
func (c botSettings) shotDamage() uint16 {
	switch c.Difficulty {
	case "easy":
		return 8
	case "hard":
		return 24
	default:
		return 14
	}
}
func (m *Match) botSpawn(entity uint32, index int) joinPlayer {
	p := botPlayer(m.s.player, entity)
	p.AccountID = 900000000 + uint64(entity&0xffffff)
	p.Name = "BOT " + string(rune('1'+index))
	p.TeamIdx = byte(index)
	p.SpawnPos, p.SpawnFace = m.arena.spawnFor(byte(entity>>24) - 1)
	if m.arena.City == "" {
		p.SpawnPos = message.Vec3{X: m.s.player.SpawnPos.X + 60*m.s.player.SpawnFace.X, Y: m.s.player.SpawnPos.Y, Z: m.s.player.SpawnPos.Z + 60*m.s.player.SpawnFace.Z}
		p.SpawnFace = faceToward(p.SpawnPos, m.s.player.SpawnPos)
	}
	offset := (float64(index) - float64(m.botOptions.Opponents-1)/2) * 2.5
	p.SpawnPos.X += p.SpawnFace.Z * offset
	p.SpawnPos.Z -= p.SpawnFace.X * offset
	return p
}

// segmentBox tests the whole segment, including endpoints, against a world-space
// solid AABB. Parallel rays and shots starting inside cover are both blocked.
func segmentBox(a, b message.Vec3, box botBox) bool {
	lo, hi := 0.0, 1.0
	origins := [3]float64{a.X, a.Y, a.Z}
	ends := [3]float64{b.X, b.Y, b.Z}
	mins := [3]float64{box.Min.X, box.Min.Y, box.Min.Z}
	maxs := [3]float64{box.Max.X, box.Max.Y, box.Max.Z}
	for i := 0; i < 3; i++ {
		d := ends[i] - origins[i]
		if math.Abs(d) < 1e-9 {
			if origins[i] < mins[i] || origins[i] > maxs[i] {
				return false
			}
			continue
		}
		t0, t1 := (mins[i]-origins[i])/d, (maxs[i]-origins[i])/d
		if t0 > t1 {
			t0, t1 = t1, t0
		}
		lo = math.Max(lo, t0)
		hi = math.Min(hi, t1)
		if lo > hi {
			return false
		}
	}
	return true
}
func insideBox(p message.Vec3, b botBox) bool {
	return p.X >= b.Min.X && p.X <= b.Max.X && p.Y >= b.Min.Y && p.Y <= b.Max.Y && p.Z >= b.Min.Z && p.Z <= b.Max.Z
}

// Unknown/unverified geometry must never be interpreted as a clear shot.
// The admin must supply verified arena bounds and world-space solid obstacles.
func (m *Match) botShotClear(from, to message.Vec3) bool {
	// Temporary deployment guard: extracted mesh bounding boxes include terrain
	// volumes. Do not enable firing until triangle-level map coverage is validated.
	if os.Getenv("BOT_FIRE_DISABLED") == "1" {
		return false
	}
	g, ok := m.botOptions.Arenas[m.arena.City]
	if !ok || !g.Verified {
		return false
	}
	from.Y += 1.4
	to.Y += 1.2
	if !insideBox(from, g.Bounds) || !insideBox(to, g.Bounds) {
		return false
	}
	for _, box := range g.nearSegment(from, to) {
		if segmentBox(from, to, box) {
			return false
		}
	}
	return !m.botLineBlocked(from, to)
}
func (m *Match) botWalkClear(from, to message.Vec3) bool {
	g, ok := m.botOptions.Arenas[m.arena.City]
	if !ok || !g.Verified {
		return false
	}
	from.Y += 0.7
	to.Y += 0.7
	if !insideBox(to, g.Bounds) {
		return false
	}
	for _, box := range g.nearSegment(from, to) {
		box.Min.X -= 0.4
		box.Min.Z -= 0.4
		box.Max.X += 0.4
		box.Max.Z += 0.4
		if segmentBox(from, to, box) {
			return false
		}
	}
	return true
}

func loadBotGeometry(c *botSettings, path string) {
	var source struct {
		Map       string
		Obstacles []botBox
	}
	data, err := os.ReadFile(path)
	if err != nil {
		log.Printf("[bots] geometry unavailable: %v", err)
		return
	}
	if json.Unmarshal(data, &source) != nil || source.Map != "PVP_Paradise" || len(source.Obstacles) == 0 {
		log.Printf("[bots] invalid geometry")
		return
	}
	if c.Arenas == nil {
		c.Arenas = map[string]botArenaGeometry{}
	}
	for _, a := range csArenas {
		bounds := botBox{Min: message.Vec3{X: math.Min(a.Fence0.X, a.Fence1.X) - 80, Y: -100, Z: math.Min(a.Fence0.Z, a.Fence1.Z) - 80}, Max: message.Vec3{X: math.Max(a.Fence0.X, a.Fence1.X) + 80, Y: 300, Z: math.Max(a.Fence0.Z, a.Fence1.Z) + 80}}
		g := botArenaGeometry{Verified: true, Bounds: bounds}
		for _, b := range source.Obstacles {
			if b.Min.X <= bounds.Max.X && b.Max.X >= bounds.Min.X && b.Min.Z <= bounds.Max.Z && b.Max.Z >= bounds.Min.Z {
				g.Obstacles = append(g.Obstacles, b)
			}
		}
		g.buildGrid()
		c.Arenas[a.City] = g
	}
	log.Printf("[bots] loaded %d conservative static collider bounds", len(source.Obstacles))
}

func (g *botArenaGeometry) buildGrid() {
	g.grid = map[[2]int][]botBox{}
	for _, b := range g.Obstacles {
		for x := int(math.Floor((math.Max(b.Min.X, g.Bounds.Min.X) - .5) / 8)); x <= int(math.Floor((math.Min(b.Max.X, g.Bounds.Max.X)+.5)/8)); x++ {
			for z := int(math.Floor((math.Max(b.Min.Z, g.Bounds.Min.Z) - .5) / 8)); z <= int(math.Floor((math.Min(b.Max.Z, g.Bounds.Max.Z)+.5)/8)); z++ {
				k := [2]int{x, z}
				g.grid[k] = append(g.grid[k], b)
			}
		}
	}
}
func (g botArenaGeometry) nearSegment(a, b message.Vec3) []botBox {
	if g.grid == nil {
		return g.Obstacles
	}
	result := []botBox{}
	for x := int(math.Floor(math.Min(a.X, b.X) / 8)); x <= int(math.Floor(math.Max(a.X, b.X)/8)); x++ {
		for z := int(math.Floor(math.Min(a.Z, b.Z) / 8)); z <= int(math.Floor(math.Max(a.Z, b.Z)/8)); z++ {
			result = append(result, g.grid[[2]int{x, z}]...)
		}
	}
	return result
}

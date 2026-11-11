package main

import (
	"fmt"
	"time"

	"libmadoka/match-server/message"
	"libmadoka/match-server/packet"
)

type brZoneStageConfig struct {
	center message.Vec3
	outerR float64
	innerR float64
	wait   time.Duration
	shrink time.Duration
}

// These centers/radii come from SafeZoneReference in the extracted Bermuda
// scene. A stage changes only after the previous circle finishes closing, which
// prevents the old single-circle behavior where the client jumped straight to
// a Factory-sized ring.
var brZoneStages = []brZoneStageConfig{
	{message.Vec3{X: -520, Y: 0, Z: 110}, 2400, 1100, 45 * time.Second, 90 * time.Second},
	{message.Vec3{X: -490, Y: 0, Z: -76}, 1100, 800, 20 * time.Second, 75 * time.Second},
	{message.Vec3{X: -474, Y: 0, Z: 412}, 800, 560, 15 * time.Second, 60 * time.Second},
	{message.Vec3{X: -333, Y: 0, Z: 600}, 560, 360, 12 * time.Second, 50 * time.Second},
	{message.Vec3{X: -120, Y: 0, Z: 360}, 360, 180, 10 * time.Second, 40 * time.Second},
	{message.Vec3{X: -250, Y: 0, Z: 120}, 180, 55, 8 * time.Second, 30 * time.Second},
}

const brZoneDamage = 8

func (m *Match) startBattleRoyaleZone() {
	if len(brZoneStages) == 0 {
		return
	}
	m.brZoneStage = 1
	m.zoneOn = true
	m.zoneShrink = false
	m.zoneLastDmg = time.Now()
	m.applyBattleRoyaleZoneStage(brZoneStages[0], time.Now())
}

func (m *Match) applyBattleRoyaleZoneStage(stage brZoneStageConfig, now time.Time) {
	m.zoneCenter, m.zoneOuterR, m.zoneInnerR = stage.center, stage.outerR, stage.innerR
	m.zoneWaitEnd = now.Add(stage.wait)
	m.zoneShrinkStart = time.Time{}
	m.zoneShrink = false
	m.brZoneClosing = false
	m.brZoneNext = now.Add(stage.wait + stage.shrink)
	m.s.sendZone(m.brZoneStage, stage.center, stage.outerR, stage.center, stage.innerR, message.ZoneWaiting, stage.wait)
}

func (m *Match) stepBattleRoyaleZone(now time.Time) {
	if !m.zoneOn {
		return
	}
	stage := brZoneStages[int(m.brZoneStage)-1]
	if !m.zoneShrink && !now.Before(m.zoneWaitEnd) {
		m.zoneShrink = true
		m.brZoneClosing = true
		m.zoneShrinkStart = now
		m.s.sendZone(m.brZoneStage, m.zoneCenter, m.zoneOuterR, m.zoneCenter, m.zoneInnerR, message.ZoneShrinking, stage.shrink)
	}
	if now.Sub(m.zoneLastDmg) >= zoneDamageEvery {
		m.zoneLastDmg = now
		curR := m.zoneOuterR
		if m.zoneShrink {
			curR = lerpBattleRoyaleRadius(m.zoneOuterR, m.zoneInnerR, now.Sub(m.zoneShrinkStart), stage.shrink)
		}
		for _, p := range m.players {
			if m.lifeOf(p.entityID) != lifeAlive {
				continue
			}
			if dist2D(p.playerPos, m.zoneCenter) > curR {
				m.applyDamage(p.entityID, 0, brZoneDamage, 0)
			}
		}
	}
	if m.zoneShrink && !now.Before(m.brZoneNext) {
		if int(m.brZoneStage) >= len(brZoneStages) {
			m.zoneOn = false
			return
		}
		m.brZoneStage++
		m.applyBattleRoyaleZoneStage(brZoneStages[int(m.brZoneStage)-1], now)
	}
}

func lerpBattleRoyaleRadius(outer, inner float64, elapsed, duration time.Duration) float64 {
	if elapsed <= 0 {
		return outer
	}
	t := elapsed.Seconds() / duration.Seconds()
	if t >= 1 {
		return inner
	}
	return outer + (inner-outer)*t
}

// Bermuda's static pickup markers are part of the 1.70 client scene (level16).
// They are world anchors, not inventory. The server must materialise loot at
// those anchors after the battle scene reconnect; otherwise the client has a
// perfectly rendered map with nothing that can be picked up.
var bermudaLootAnchors = []message.Vec3{
	{-1287.42, 3.66, 120.31}, {-1160.268, 13.2, -531.003}, {-1023.82, 34.41, 166.15},
	{-955.18, 48.99, 488.973}, {-915.6, 48.89, 454.67}, {-878.352, 54.74, 525.625},
	{-860.927, 56.03, 197.538}, {-783.52, 77.0, 135.47}, {-680.18, 31.03, -228.49},
	{-674.96, 77.44, 9.82}, {-661.198, 29.92, 489.709}, {-612.417, 28.76, -307.785},
	{-598.84, 27.2, -545.57}, {-579.711, 25.67, -215.092}, {-517.42, 24.76, -529.36},
	{-491.555, 49.38, 141.188}, {-472.51, 18.95, 278.76}, {-447.64, 14.01, 569.8},
	{-390.5, 31.68, 78.95}, {-388.43, 19.1, 156.46}, {-385.66, 9.23, 810.54},
	{-333.59, 9.31, 788.04}, {-318.5, 33.62, 412.34}, {-316.655, 33.62, 196.732},
	{-259.16, 9.23, 769.28}, {-259.95, 9.23, 661.68}, {-213.077, 0.17, -47.036},
	{-192.12, 5.33, 286.5}, {-161.12, 5.41, 402.22}, {-138.588, 1.9, 326.49},
	{-131.922, 1.91, 403.396}, {-36.602, 9.1, 477.863}, {-34.34, 8.86, 586.78},
	{63.394, 7.78, 486.565}, {66.3, 0.33, 565.34}, {106.251, 28.07, 389.16},
	{121.51, 33.17, 407.29}, {145.9, 32.83, 342.7}, {170.77, 27.14, 337.38},
}

var bermudaGroundWeapons = []uint32{8, 7, 33, 24, 6, 12, 15, 21, 4, 5, 41, 43}

// seedBattleRoyaleWorld is idempotent for one match. Each anchor gets a small
// shared container with a weapon, its ammo, a medkit, and occasional armour.
// Item IDs are validated by the existing pickup handler, so this uses the same
// catalogue IDs as the working CS loadout/shop paths.
func (m *Match) seedBattleRoyaleWorld() {
	if !m.battleRoyale || len(m.containers) != 0 || len(m.players) == 0 {
		return
	}
	m.ensureWorldLoot()
	for i, pos := range bermudaLootAnchors {
		id := m.nextContainerID
		m.nextContainerID++
		if m.nextContainerID < runtimeContainerBase || m.nextContainerID > runtimeContainerMax {
			m.nextContainerID = runtimeContainerBase
		}
		weapon := bermudaGroundWeapons[i%len(bermudaGroundWeapons)]
		ammo := weaponAmmo[weapon]
		items := []lootItem{
			{unique: 0x61000000 | uint32(i*4+1), data: weapon, count: 1, runtime: loadedMagFor(weapon, 0)},
			{unique: 0x61000000 | uint32(i*4+2), data: ammo, count: ammoReserveTotal(ammo)},
			{unique: 0x61000000 | uint32(i*4+3), data: medkitData, count: 1, runtime: 1},
		}
		if i%3 == 0 {
			items = append(items, lootItem{unique: 0x61000000 | uint32(i*4+4), data: 302, count: 1})
		}
		box := &container{id: id, pos: pos, ctype: message.ContainerNormal, items: items}
		m.containers[id] = box
		for _, it := range items {
			m.broadcastData(packet.CmdAddPickup, message.AddPickup(it.pickupItem(id), pos, message.ContainerNormal),
				fmt.Sprintf("cmd=114 BR static loot box=%d data=%d pos=(%.0f,%.0f)", id, it.data, pos.X, pos.Z))
		}
	}
}

func (m *Match) ensureWorldLoot() {
	if m.containers == nil {
		m.containers = map[uint16]*container{}
	}
	if m.nextContainerID < runtimeContainerBase || m.nextContainerID > runtimeContainerMax {
		m.nextContainerID = runtimeContainerBase
	}
}

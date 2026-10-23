package message

// ActiveSkillState builds the legacy five-field skill state (cmd 237).
//
// Wire format (fixed-width little endian):
//
//	[u32 playerID][u32 skillID][u32 state][f32 lastEffectTime][f32 lastCastingTime]
//
// Times use the match clock in seconds, the same timebase sent through cmd 1000.
// That lets the client calculate the effect/cooldown transition locally while the
// match server remains the authority that begins and ends an activation.
func ActiveSkillState(playerID, skillID, state uint32, lastEffectTime, lastCastingTime float32) []byte {
	w := &Writer{}
	w.U32(playerID)
	w.U32(skillID)
	w.U32(state)
	w.F32(lastEffectTime)
	w.F32(lastCastingTime)
	return w.B
}

// ActiveSkillStateCurrent builds the 30-byte command-246 layout used by the
// current client family. A live capture established the two deadlines:
// cooldownEndMS is the match-clock millisecond at which the button becomes
// available again, while effectEndTime is the match-clock second at which the
// visible effect ends.
func ActiveSkillStateCurrent(playerID, skillID, state uint32, castTime float32, cooldownEndMS uint32, phase int32, effectEndTime float32, phases []int32) []byte {
	w := &Writer{}
	w.U32(playerID)
	w.U32(skillID)
	w.U32(state)
	w.F32(castTime)
	w.U32(cooldownEndMS)
	w.U32(uint32(phase))
	w.F32(effectEndTime)
	w.U16(uint16(len(phases)))
	for _, p := range phases {
		w.U32(uint32(p))
	}
	return w.B
}

// ActiveSkillState170 is kept as a source-compatible alias for older tests and
// tools which used the provisional field names.
func ActiveSkillState170(playerID, skillID, state uint32, castTime float32, cooldownEndMS uint32, phase int32, effectEndTime float32, phases []int32) []byte {
	return ActiveSkillStateCurrent(playerID, skillID, state, castTime, cooldownEndMS, phase, effectEndTime, phases)
}

const (
	SkillStartCasting   uint32 = 0
	SkillStartEffecting uint32 = 1
	SkillStopEffecting  uint32 = 2
	SkillCooldownReady  uint32 = 4
)

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

// ActiveSkillState170 is retained for protocol experiments with later variants.
// Free Fire 1.70 command 246 uses ActiveSkillState's 20-byte layout instead.
func ActiveSkillState170(playerID, skillID, state uint32, castingTime float32, resolvedSkill uint32, phase int32, cooldownTime float32, phases []int32) []byte {
	w := &Writer{}
	w.U32(playerID)
	w.U32(skillID)
	w.U32(state)
	w.F32(castingTime)
	w.U32(resolvedSkill)
	w.U32(uint32(phase))
	w.F32(cooldownTime)
	w.U16(uint16(len(phases)))
	for _, p := range phases {
		w.U32(uint32(p))
	}
	return w.B
}

const (
	SkillStartCasting   uint32 = 0
	SkillStartEffecting uint32 = 1
	SkillStopEffecting  uint32 = 2
)

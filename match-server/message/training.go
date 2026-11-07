package message

type TrainingCatalogEntry struct {
	ItemID   uint32
	Index    uint32
	Category uint32
	Enabled  bool
}

func TrainingCatalog(playerID, catalogID uint32, entries []TrainingCatalogEntry) []byte {
	w := &Writer{}
	w.U32(playerID)
	w.U32(catalogID)
	w.I16(int16(len(entries)))
	for _, entry := range entries {
		w.U32(entry.ItemID)
		w.U32(entry.Index)
		w.U32(entry.Category)
		w.Bool(entry.Enabled)
	}
	return w.B
}

func TrainingItemGranted(playerID, itemID uint32) []byte {
	w := &Writer{}
	w.U32(playerID)
	w.U32(itemID)
	return w.B
}

func TrainingShowShop(playerID, shopID uint32, active bool) []byte {
	w := &Writer{}
	w.U32(playerID)
	w.U32(shopID)
	w.Bool(active)
	return w.B
}

func TrainingJoinFinished(playerID uint32) []byte {
	w := &Writer{}
	w.U32(playerID)
	return w.B
}

// TrainingGRI is the stable game-wide replication block observed throughout
// a working Training session: u16 field 0 = 1, u16 field 1 = 0, u8 field 2 = 0.
func TrainingGRI() []byte {
	return ReplicationBlock([]RepEntry{
		{Type: RepU16, Field: 0, Value: 1},
		{Type: RepU16, Field: 1, Value: 0},
		{Type: RepU8, Field: 2, Value: 0},
	})
}

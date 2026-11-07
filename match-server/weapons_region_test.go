package main

import "testing"

func TestParseWeaponSkinTablePrefersConfiguredRegion(t *testing.T) {
	csv := []byte("SkinID,name,region,x,WeaponID,x,ammo_clip_size\nheader,header,header,header,header,header,header\n907102710,IND skin,EUROPE;IND;SG,,7,,-2\n907102710,BR skin,BR,,7,,\n")
	skins, mods := parseWeaponSkinTable(csv, "IND")
	if skins[907102710] != 7 {
		t.Fatalf("weapon mapping = %d, want 7", skins[907102710])
	}
	if mods[907102710] != -2 {
		t.Fatalf("IND clip modifier = %d, want -2", mods[907102710])
	}
}

func TestEmbeddedWeaponSkinTableLoadsAllUniqueSkins(t *testing.T) {
	skins, mods := parseWeaponSkinTable(weaponSkinCSV, "IND")
	if len(skins) != 810 {
		t.Fatalf("loaded %d unique skins, want 810", len(skins))
	}
	if len(mods) != len(skins) {
		t.Fatalf("modifier count %d does not match skin count %d", len(mods), len(skins))
	}
	if mods[907102710] != -2 {
		t.Fatalf("skin 907102710 modifier = %d, want -2 for IND", mods[907102710])
	}
}

# Testing the local server on a physical Android device

The prepared APK trusts the local mitmproxy certificate and is aligned and signed with APK Signature Schemes v1, v2, and v3 for current Android releases. It uses the phone's Wi-Fi proxy to route the private-server HTTPS domains to the PC while leaving CDN traffic online. The TCP gateway and UDP match server are advertised directly on the PC's LAN address.

## Prepared mobile files

- APK: `D:\Games\oldff2022-android-lan\oldff2022-lan-signed.apk`
- OBB: `D:\Games\oldff2022-android-lan\main.2019114971.com.dts.freefireth.obb`
- Package: `com.dts.freefireth`

The APK uses the same local test signature as the emulator build. Android cannot update an installation signed by a different key, so uninstall a conflicting `com.dts.freefireth` installation first. Copy the OBB after installing the APK.

## Start the PC stack

Open PowerShell in `D:\Games\FreeFireServer-master` and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-lan-test.ps1 -LanAddress 192.168.1.2
```

The launcher starts the live, auth, login, main, TCP notification, TCP chat,
matchmaking, Redis-compatible, UDP match, and proxy services. It advertises
`192.168.1.2:10200` for chat, `192.168.1.2:10300` for lobby notifications, and
`192.168.1.2:10100` for matches. Logs and process IDs are stored under
`data\lan-test`.

## Install over USB with ADB

Enable Developer options and USB debugging, connect the phone, accept its authorization prompt, then run:

```powershell
adb devices
adb install "D:\Games\oldff2022-android-lan\oldff2022-lan-signed.apk"
adb shell mkdir -p /sdcard/Android/obb/com.dts.freefireth
adb push "D:\Games\oldff2022-android-lan\main.2019114971.com.dts.freefireth.obb" /sdcard/Android/obb/com.dts.freefireth/
```

On newer Android releases, direct ADB access to `/sdcard/Android/obb` can be restricted. In that case, copy the OBB with the phone's file manager after granting it storage access, or install through an XAPK installer that can place OBB files.

## Configure the phone

Connect the phone and PC to the same local network. In the active Wi-Fi network's advanced settings, set:

- Proxy: Manual
- Proxy hostname: `192.168.1.2`
- Proxy port: `8080`

Keep the proxy enabled while using this build. Open the APK, use the Facebook-style local login page, and create a disposable local login if the ephemeral auth service was restarted.

The router must allow devices on the network to communicate with each other. Guest Wi-Fi and AP/client isolation will prevent the phone from reaching the PC. Windows Firewall must permit inbound TCP ports `3000,3001,3002,5000,8080,10200,10300,25565` and inbound UDP port `10100` on the Private profile.

## Stop the stack

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-lan-test.ps1
```

Remove the manual Wi-Fi proxy from the phone afterward so normal web access does not depend on the PC.

### 2026-10-21: active-skill protocol and squad audit

Verified against the original 1.70 ARM64 library and metadata in oldff2022-analysis/il2cpp-input, not the older Barbosa dump. Metadata extracted using Il2CppDumper.Metadata independently of the failing full dump. Native type records and selected method bodies use XOR 0xCD. Analysis helpers and results are in .tmp/metadata-audit; do not confuse stale dump.cs copied with the tools with a successful current-client dump.

GPBEINJKAFN (type index 6588) is consumed by Player.SyncActiveSkillStatus, method 36940 / RVA 0x18f722c. Its UnSerialize method 106491 / RVA 0x368c000 reads: u32 player, u32 skill, u32 state, f32 casting time, u32 resolved skill, i32 phase, f32 cooldown timing value, i16 count, then count i32 values. Minimum payload is 30 bytes. Previous backend sent the legacy 20-byte layout, which omitted required fields and placed a float where the current client reads a skill ID. Native runtime consumer PFLCPEHBBLN.KLMGBBPMHDD at 0x1871a14 copies these fields; phase is passed to ActiveSkillData.GetKeepingTime. Current server sends phase 0 and no pending phases; additional phase behavior/timing semantics remain to verify in game.

IDs: UDP 244 use, 245 cancel, 246 state; legacy 235/236/237 uses the old layout. UDP 170 buff behavior, 250 marked enemies, 253 action skill are distinct mechanisms and are not interchangeable. Moco is still only logged on damage: no verified mark serializer has been implemented. Do not report Moco fixed. Enemy-visible Alok may require a separate buff/action update; broadcasting cmd246 alone is not proof of visible effects.

Changes: current-client packet encoder; retries during an active effect cannot emit stop; no dead-player activation; healing cannot extend past effect expiry or overflow max HP. Per-peer reliable skill ACK logging added. Server timing values remain provisional and not fully matched to client tables.

Squad TCP protocol 5: create1, invite2/notify3, accept4/join6, leave7/notify8, start9/notify10, stop11/notify12, dismiss13, info14, ready15/notify16, change17/notify18, code31/32, join33/request34, kick35, public36/37, acceptjoin38. Verified loaded schemas. Added join request acceptance, code lookup, public/private and available-map routes. Preserve field presence on mode changes; omitted fields must not reset mode to zero. Kicked/leaving client receives dismissal. Start enqueues party entries in one Redis HSET; complete parties remain together and receive same team token in Clash Squad. Remaining limitations: groups are process-local, incomplete cancelled parties need retry/cleanup, full post-match/reconnect lifecycle still needs end-to-end validation.

Validation: Go test ./... passed; group-lifecycle-smoke (including real protobuf/router partial update), party-match-smoke, character-system-smoke and match-skill-handoff-smoke passed. Rebuilt local executable and restarted LAN stack on 192.168.1.2 with proxy retained. Prior logs copied to data/lan-test-archive/skill-audit-* before restart. No in-game visual verification yet. Test two consecutive Alok activations after cooldown on both devices, and squad join -> Ready -> captain Start -> leave/rejoin. This is a tested backend correction, not completion of every character ability.

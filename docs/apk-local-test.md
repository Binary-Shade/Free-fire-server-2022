# Testing the 1.70 APK against the local backend

This procedure was validated with `justsyedx2oldff2022_v1.70.0.xapk.zip` in MSI App Player. It routes only the APK's private-server hosts to local services. CDN requests continue to their original destinations.

Use a disposable emulator and test credentials. The patched APK is signed with a local test key, so Android cannot install it over a copy signed by somebody else. Preserve the OBB, uninstall the existing package, install the test APK, and restore the OBB.

## Prepared artifacts

- Patched APK: `D:\Games\oldff2022-local-test\oldff2022-local-signed.apk`
- Required OBB: `D:\Games\oldff2022-local-test\main.2019114971.com.dts.freefireth.obb`
- mitmproxy routing addon: `scripts\apk-local-proxy.py`
- Disposable shared auth server: `scripts\apk-local-auth-server.js`
- Captured flow file: `data\apk-local-test.mitm`

The APK patch only extends its network security configuration to trust the embedded mitmproxy CA (`res/raw/mitmproxy_ca.pem`). The original XAPK archive remains unchanged.

## Start the services

Open five PowerShell terminals in the repository root. Set the environment in each terminal before starting its service.

Live/version service:

```powershell
$env:PORT='3000'
$env:GAME_VERSION='1.70.4'
npm run live
```

Login service:

```powershell
$env:PORT='3001'
$env:DB_FILE="$PWD\data\apk-local-test.db"
$env:LOGIN_DOMAIN='https://loginbp.samosasmobiles.dpdns.org'
$env:MAIN_DOMAIN='https://loginbp2.samosasmobiles.dpdns.org'
$env:TCP_PUBLIC_HOST='10.0.2.2'
$env:MATCH_PUBLIC_HOST='10.0.2.2'
npm run login
```

Main/lobby service:

```powershell
$env:PORT='3002'
$env:DB_FILE="$PWD\data\apk-local-test.db"
npm run main
```

Disposable local authentication services:

```powershell
npm run apk-auth-test
```

HTTPS routing proxy:

```powershell
& 'C:\Program Files\mitmproxy\bin\mitmdump.exe' -s scripts\apk-local-proxy.py -p 8080 -w data\apk-local-test.mitm
```

`apk-auth-test` stores users in memory. Restarting it removes its accounts, so it is suitable for protocol tests only.

## Configure MSI App Player

The MSI/BlueStacks Android guest reaches the Windows host as `10.0.2.2`.

```powershell
$adb = 'C:\Program Files\BlueStacks_msi5\HD-Adb.exe'
& $adb connect 127.0.0.1:5555
& $adb -s 127.0.0.1:5555 shell settings put global http_proxy 10.0.2.2:8080
& $adb -s 127.0.0.1:5555 push 'D:\Games\oldff2022-local-test\main.2019114971.com.dts.freefireth.obb' '/sdcard/Android/obb/com.dts.freefireth/main.2019114971.com.dts.freefireth.obb'
```

Launch package `com.dts.freefireth`, choose the Facebook sign-in button, and create a disposable local username/password in the page supplied by the local auth service. On a new database, the first `MajorLogin` correctly reports that the game account does not exist; the client then opens nickname registration, calls `MajorRegister`, retries `MajorLogin`, and loads the lobby through `GetLoginData` and the main API endpoints.

## What constitutes a pass

The proxy and server logs should show this sequence:

1. `GET /live/ver.php`
2. `POST /oauth/token/facebook/exchange`
3. `POST /MajorLogin` (unknown account on first use)
4. `POST /MajorRegister`
5. `POST /MajorLogin`
6. `POST /GetLoginData`
7. Lobby calls such as `GetPlatformProfile`, `LoginGetDesc`, `LoginGetProfile`, `GetPlayerPersonalShow`, and `GetBackpack`

Reaching the rendered lobby proves HTTPS interception, local authentication, encrypted 1.70 login packets, account registration, bearer-token handoff, and the HTTP/protobuf lobby API are compatible with this APK.

## Match testing

The **Start** button goes beyond the HTTP test. `GetLoginData` must advertise `10.0.2.2:10300` through `TCP_PUBLIC_HOST` and `10.0.2.2:10100` through `MATCH_PUBLIC_HOST`. Then start `npm run tcp`, the matchmaker and its Redis dependency, and the separate realtime game server on UDP/TCP port 10100. The Node repository implements the lobby and match handoff; it does not by itself replace every simulation feature of the realtime game server.

### Windows portable local match stack

The required portable runtimes are installed outside the repository:

- `D:\Games\tools\go1.27.1\go\bin\go.exe`
- `D:\Games\tools\valkey-9.1.2\Valkey-9.1.2-Windows-x64-msys2\valkey-server.exe`

Both downloaded archives were SHA-256 verified before extraction. Start Valkey first:

```powershell
& 'D:\Games\tools\valkey-9.1.2\Valkey-9.1.2-Windows-x64-msys2\valkey-server.exe' --bind 127.0.0.1 --port 6379 --save '' --appendonly no
```

The realtime executable is built at `match-server\match-server.exe`. Start it for the emulator-host bridge, with a solo bot for a one-player test:

```powershell
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:NODE_ID='local-match'
$env:MATCH_ADVERTISE='10.0.2.2:10100'
$env:MATCH_JWT_SECRET='dev-match-secret-change-me'
$env:MATCH_BOT='1'
$env:MATCH_NO_ZONE='1'
.\match-server\match-server.exe -addr ':10100'
```

Start the TCP gateway with the same Redis URL, match host and JWT secret. Run the dedicated matchmaker with `MM_MIN_PLAYERS=1` and `MM_TIMEOUT_MS=3000` for a single-client test. Its queue notification sends a signed `prepare_token`; the UDP match server verifies that token before allowing the client into the match.

The 2026-10-18 run reached a live Clash Squad purchase phase, accepted a shop purchase, and spawned the bot after the solo waiting period. `lobby-reinstalled.png` records the rendered in-match client.

## Lobby banners and marquee text

Edit `config/lobby-content.js` to change the banner title, description, click URL, region, language, and the `marquee` messages. Separate multiple `LOBBY_MARQUEE` messages with `|` when setting it from PowerShell.

For a local banner image, copy a PNG or JPG to `public\banners\home.png` and start the login/main services with:

```powershell
$env:LOBBY_BANNER_IMAGE_URL='https://loginbp2.samosasmobiles.dpdns.org/assets/banners/home.png'
$env:LOBBY_MARQUEE='Welcome to my server!|Solo Clash Squad bots are online.'
```

The `main` service exposes `public` at `/assets`; the existing mitmproxy mapping makes this URL resolve to the local machine for the patched APK. Restart the login and main services, then return to the title screen and sign in again to refresh cached lobby content.

### Admin dashboard and Cloudinary

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the environment used to start the **main** service. These values stay on the local server: the dashboard never receives the Cloudinary API secret.

Open `http://127.0.0.1:3002/admin/` on Windows. The dashboard edits marquee lines and banner fields, uploads a PNG/JPG/WebP image to Cloudinary, and saves the selected Cloudinary `secure_url` in the ignored local file `data/lobby-content.json`.

## Cleanup

Stop the five terminals and remove the emulator proxy:

```powershell
$adb = 'C:\Program Files\BlueStacks_msi5\HD-Adb.exe'
& $adb -s 127.0.0.1:5555 shell settings delete global http_proxy
```

For a physical phone on the same network, use the packaged build and LAN launcher in [android-lan-test.md](android-lan-test.md).

# Free Fire 1.70 OBB and protocol analysis

## Source and integrity

- OBB: `Working-Builds/Original-main.2019114971.com.dts.freefireth.obb`
- SHA-256: `4e481bd0cb81ca48e2d0b603591bb58c2783ba4397e2ebee4cbc31c59da85aa7`
- Format: ZIP-based Android expansion archive
- Unity version identified by AssetRipper: `2018.4.11f1`
- Archive entries: 33,964
- Uncompressed size: 1,352,964,299 bytes
- Compressed payload: 583,635,945 bytes
- REA inventory evidence: `ev_70e93298ef08b0cb9a3a5c0aa54d758752c3ad57b73769acea49101713189220`
- REA found a complete source inventory and no integrity contradictions.

## Resource content

The archive is primarily Unity AssetBundles. The normalized extraction is in `data/analysis/obb-extracted`. AssetRipper exported 6,561 primary assets (about 3.3 GB) into `data/analysis/obb-primary-export`:

- 3,117 GLB models and scene hierarchies
- 2,258 JSON assets
- 1,183 PNG textures
- 2 OGG audio clips
- 1 TTF font

Important configuration bundles include `itemtable`, `weapontable`, `weaponskin_property`, `weaponskin_propertyscore`, `gamevar`, `resconf`, `avatarlookat`, `autopickupconfig`, `collectionbanner`, `clothesslotoverlays`, and `ingamebonus`.

## Server-useful catalogs

- `protocol/ItemTable.csv`: 428 item records, including item IDs, names, types, model references, pickup resources, capacity, and scores.
- `protocol/WeaponTable.csv`: 117 weapon records with damage, magazine, ammo ID, timing, range, reload, attachments, effects, and animation references.
- `protocol/WeaponSkin.csv`: 1,017 weapon-skin records and stat modifiers.
- `protocol/CollectionEmote.csv`: 120 emotes with animation, prop, VFX, SFX, and icon references.
- `protocol/gamemode_and_map_config.txt`: map/config/mode IDs, scene resource IDs, waiting maps, navmesh names, map flags, and dependencies. Training is config 7023, map 7, mode 23, `PVP_AlphaIsland_Training`.
- `data/analysis/obb-model-resource-catalog.csv`: named models, textures, audio, and resource paths found in the export.
- `data/analysis/exported/obb-numeric-ids.csv`: numeric IDs visible in exported filenames and paths.
- `data/analysis/obb-resource-catalog.csv`: complete normalized OBB file inventory.

The export confirms training resources including `Tra_Grenade_Trainingroom`, open/closed weapon-box meshes, the Alpha Island environment, training audio, vehicle assets, map textures, scene hierarchies, and collision geometry.

## Network channels

Network command IDs are not stored in the OBB resource archive. They come from the client executable/protobuf metadata and are correlated here with this 1.70 resource set:

- HTTP/login and lobby API: 418 unique numeric commands, 418 named endpoints, and 494 caller mappings. See `data/analysis/client-http-command-catalog.csv`.
- Realtime gameplay: 526 named RUDP commands. See `data/analysis/client-udp-command-catalog.csv`.
- TCP notification/matchmaking gateway: port 10300.
- TCP chat channel: port 10200.
- UDP realtime match channel: port 10100.

The source catalogs are `protocol/endpoint_map.json`, `protocol/cmd_map.json`, `protocol/udp_cmds.txt`, and the protobuf definitions under `protocol/protos`.

## Important limitation

The OBB provides resource names, models, textures, scenes, collision meshes, and serialized configuration bundles. It does not contain login routes, server addresses, HTTP command dispatch, TCP framing, or RUDP command logic. Those are implemented in the APK's managed/native client code. Some AssetBundles also depend on `globalgamemanagers.assets` and `sharedassets0.assets` from the APK; therefore exact MonoBehaviour field decoding requires analyzing the matching APK alongside this OBB. Random printable strings from compressed bundles are not treated as trustworthy IDs.

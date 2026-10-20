# Chat service protocol and architecture

The legacy client connects to `GetLoginData.chat_addr` on TCP port `10200`.
The transport uses the same asymmetric framing and AES client-to-server payload
encryption documented in `TCP_PROTOCOL.md`.

## Wire protocols

- Base protocol `18` (`EProtocol.CHANNEL`)
  - `1 TEXT_MSG`: client sends `TextMsgReq`; server acknowledges command 1.
  - `2 TEXT_MSG_NTF`: server pushes a sanitized `TextMsgReq` to recipients.
  - `3 JOIN_CHANNEL`: `ChannelIDReq`; joins and replays recent history.
  - `4 LEAVE_CHANNEL`: `ChannelIDReq`; removes membership.
  - `5 JOIN_WORLD_CHAN_NTF`: confirms the resolved world channel.
- Base protocol `30` (`EProtocol.CHAT`)
  - `1 REPORT_CHAT`: stores `ReportChatReq` for moderation.
  - `2 LIKE_MSG`: validates and acknowledges `LikeMsgReq`.

## Delivery model

Every chat instance subscribes to `ps:chat.push`. Redis sets hold channel
membership, lists hold bounded recent history and offline whispers, and
`chat:presence:<uid>` TTL keys identify connected recipients. This permits
multiple chat processes without sticky load balancing. Messages carry a profile
built by the server; client-supplied sender IDs and profile fields are ignored.

Supported channel types are group, clan, whisper, room, championship team,
world, fast group, cup and series team. The client explicitly joins shared
channels. World channel 1 is joined automatically after authentication.

Safety limits are configurable with `CHAT_RATE_WINDOW_MS`, `CHAT_RATE_MAX`,
`CHAT_MAX_CONTENT`, `CHAT_HISTORY_LIMIT`, `CHAT_OFFLINE_LIMIT`, and
`CHAT_RETENTION_SEC`.

# Leer's TS module: Discord Guest Voice Channel
Sets a permission overwrite ViewChannel to a voice channel when user connects to this channel (for example by moving them from other channel)

## Features
1. Adds slash commands:

|Name|Type|Description|
|---|---|---|
|`/guest-channels-add`|Guild-only|Adds a new channel|
|`/guest-channels-get`|Guild-only|Sends info above about all added channels as discord embed message|
|`/guest-channels-remove`|Guild-only|Removes specified added channel|

1. If command `/guest-channels-get` is banned on server by slash command allowing/banning system, module will stop functioning on this server

## How to install this module?
- Go to [parent repository](https://github.com/TheLeerName/ts-module-core) and read `README.md` file
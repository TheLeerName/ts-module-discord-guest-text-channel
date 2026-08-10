# Leer's TS module: Discord Guest Text Channel
Adds discord text channel, which unlocks only for voice members, before starting using this on discord server, please check `/guest-text-channel-set` command description

## Features
1. Adds slash commands:

|Name|Description|
|---|---|
|`/guest-text-channel-set`|Sets some required parameters for discord server:<br>- Voice channel which will be tracked for joined/left members<br>- Text channel which will be unlocked/locked for joined/left members|
|`/guest-text-channel-get`|Sends these parameters above as discord embed message|

2. If command `/guest-text-channel-get` is banned on server by slash command allowing/banning system, module will stop functioning on this server

## How to install this module?
- Go to [parent repository](https://github.com/TheLeerName/ts-module-core) and read `README.md` file
import Module from "../../index.js";
import { ChannelStateManager, type ChannelStateManagerSave } from "../channel.js";
import type { GuildStateManager } from "../guild.js";

import { type Guild } from "discord.js";

export interface GuildStateSave {
	guildID: string;
	channels: ChannelStateManagerSave;
}

export class GuildState {
	guild?: Guild;
	guildID: string;

	channels: ChannelStateManager = new ChannelStateManager(this);

	readonly manager: GuildStateManager;
	constructor(manager: GuildStateManager) {
		this.manager = manager;
	}

	isAvailable(): this is GuildStateAvailable {
		return this.guild != null && this.guild.available;
	}
	getGuildName() {
		return this.guild != null ? Module.discord.getGuildNameAndID(this.guild) : this.guildID;
	}

	fromJSON(json: GuildStateSave) {
		this.guildID = json.guildID;
		this.channels.fromJSON(json.channels);
	}
	toJSON(): GuildStateSave {
		return {
			guildID: this.guild?.id ?? this.guildID,
			channels: this.channels.toJSON(),
		};
	}
}

export interface GuildStateAvailable extends GuildState {
	guild: Guild;
}
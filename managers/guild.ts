import Module from "../index.js";
import { GuildState, type GuildStateSave, type GuildStateAvailable } from "./states/guild.js";

import type {
	Guild,
	DMChannel,
	NonThreadGuildBasedChannel,
	VoiceState,
} from "discord.js";

export type GuildStateManagerSave = GuildStateSave[];

export class GuildStateManager extends Map<string, GuildState> {
	protected _availableGuildsCount = 0;

	/** NOTE: this method may set {@link Module.data.needsSave} to `true` */
	createAndGet(guild: Guild): GuildState {
		let state = this.get(guild.id);
		if (state == null) {
			state = new GuildState(this);
			state.guild = guild;
			state.guildID = guild.id;
			this.set(guild.id, state);
			Module.data.needsSave = true;
			Module.log.warn("Guild state was created without guildCreate event", {args: {
				guild: state.getGuildName(),
			}});
		}
		return state;
	}
	registerDiscordCallbacks() {
		Module.discord.client
			.on("guildCreate", g => this.onGuildCreate(g))
			.on("guildUpdate", (oldGuild, newGuild) => this.onGuildUpdate(oldGuild, newGuild))
			.on("guildDelete", g => this.onGuildDelete(g))
			.on("guildAvailable", g => this.onGuildAvailable(g))
			.on("channelUpdate", (oldChannel, newChannel) => this.onChannelUpdate(oldChannel, newChannel))
			.on("channelDelete", channel => this.onChannelDelete(channel))
			.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
	}

	fromJSON(array: GuildStateManagerSave) {
		for (const save of array) {
			const state = new GuildState(this);
			state.fromJSON(save);
			this.set(state.guildID, state);
		}
	}
	toJSON(): GuildStateManagerSave {
		return Array.from(this.values()).map(g => g.toJSON());
	}

	protected async onGuildCreate(guild: Guild) {
		this._availableGuildsCount++;

		if (!Module.isAllowedInGuild(guild)) return;

		let state = this.get(guild.id);
		if (state != null) {
			state.guild = guild;
			state.guildID = guild.id;
		}
		else {
			state = new GuildState(this);
			state.guild = guild;
			state.guildID = guild.id;
			this.set(guild.id, state);
			Module.data.needsSave = true;
		}
		Module.data.save();
	}
	protected onGuildUpdate(oldGuild: Guild, newGuild: Guild) {
		if (!Module.isAllowedInGuild(newGuild)) return;

		const state = this.get(newGuild.id);
		if (state == null) return;

		state.guild = newGuild;
	}
	protected onGuildDelete(guild: Guild) {
		this._availableGuildsCount--;

		if (!Module.isAllowedInGuild(guild)) return;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = state.guild;
	}
	protected async onGuildAvailable(guild: Guild) {
		this._availableGuildsCount++;

		if (!Module.isAllowedInGuild(guild)) return;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = guild;
		state.guildID = guild.id;
		await state.channels.onGuildAvailable(state as GuildStateAvailable);
		if (this._availableGuildsCount >= Module.discord.client.guilds.cache.size)
			Module.data.save(true);
	}
	protected onGuildUnavailable(guild: Guild) {
		this._availableGuildsCount--;

		if (!Module.isAllowedInGuild(guild)) return;

		const state = this.get(guild.id);
		if (state == null) return;

		state.guild = guild;
	}
	protected onChannelUpdate(oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
		if (newChannel.isDMBased()) return;
		if (!Module.isAllowedInGuild(newChannel.guild)) return;

		const state = this.get(newChannel.guild.id);
		if (state == null) return;

		state.channels.onChannelUpdate(oldChannel, newChannel);
	}
	protected onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel) {
		if (channel.isDMBased()) return;
		if (!Module.isAllowedInGuild(channel.guild)) return;

		const state = this.get(channel.guild.id);
		if (state == null) return;

		state.channels.onChannelDelete(channel);
	}
	protected async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
		if (!Module.isAllowedInGuild(newState.guild)) return;

		if (oldState.channelId === newState.channelId) return;

		// on join
		if (newState.channelId != null) {
			const state = this.get(newState.guild.id);
			if (state == null) return;

			await state.channels.onVoiceStateUpdate(newState as Parameters<typeof state.channels.onVoiceStateUpdate>[0], true);
		}
		// on left
		if (oldState.channelId != null) {
			const state = this.get(oldState.guild.id);
			if (state == null) return;

			await state.channels.onVoiceStateUpdate(oldState as Parameters<typeof state.channels.onVoiceStateUpdate>[0], false);
		}
	}
}

export {
	GuildState,
	type GuildStateAvailable,
	type GuildStateSave,
} from "./states/guild.js";
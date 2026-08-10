import Module from "./index.js";
import DiscordModule from "../discord/index.js";
import { BaseData } from "../../data.js";

import * as Discord from "discord.js";

export const GuildNonThreadTextBasedChannelTypes = [Discord.ChannelType.GuildAnnouncement, Discord.ChannelType.GuildStageVoice, Discord.ChannelType.GuildText, Discord.ChannelType.GuildVoice] as const;
export type GuildNonThreadTextBasedChannel = Exclude<Discord.GuildTextBasedChannel, Discord.AnyThreadChannel>;
export function isGuildNonThreadTextBasedChannel(channel: Discord.Channel): channel is GuildNonThreadTextBasedChannel {
	return GuildNonThreadTextBasedChannelTypes.includes(channel.type as any);
}
export class Guild {
	guild: Discord.Guild | null;
	enabled: boolean;
	voiceMembers: string[];

	voiceChannel: Discord.VoiceBasedChannel | undefined;
	voiceChannelID: string | undefined;

	textChannel: Guild.Enabled["textChannel"] | undefined;
	textChannelID: string | undefined;

	constructor(guild: typeof this.guild, enabled: typeof this.enabled, voiceMembers: typeof this.voiceMembers, voiceChannel: typeof this.voiceChannel | typeof this.voiceChannelID, textChannel: typeof this.textChannel | typeof this.textChannelID) {
		this.guild = guild;
		this.enabled = enabled;
		this.voiceMembers = voiceMembers;

		if (voiceChannel) {
			if (typeof voiceChannel === "string")
				this.voiceChannelID = voiceChannel;
			else
				this.voiceChannel = voiceChannel;
		}

		if (textChannel) {
			if (typeof textChannel === "string")
				this.textChannelID = textChannel;
			else
				this.textChannel = textChannel;
		}
	}

	isEnabled(): this is Guild.Enabled {
		return this.enabled;
	}

	enable(guild: Exclude<typeof this.guild, null>, voiceChannel: Exclude<typeof this.voiceChannel, null>, textChannel: Exclude<typeof this.textChannel, null>): Guild.Enabled {
		this.guild = guild;
		this.enabled = true;

		this.voiceChannel = voiceChannel;
		this.voiceChannelID = undefined;

		this.textChannel = textChannel;
		this.textChannelID = undefined;

		return this as any;
	}
	disable(): Guild.Disabled {
		this.guild = null;
		this.enabled = false;

		this.voiceChannelID = this.voiceChannel?.id;
		this.voiceChannel = undefined;

		this.textChannelID = this.textChannel?.id;
		this.textChannel = undefined;

		return this as any;
	}

	toJSON(): {
		enabled: boolean;
		voiceMembers: string[];
		voiceChannelID?: string;
		textChannelID?: string;
	} {
		return {
			enabled: this.enabled,
			voiceMembers: this.voiceMembers,
			voiceChannelID: this.voiceChannel?.id ?? this.voiceChannelID,
			textChannelID: this.textChannel?.id ?? this.textChannelID,
		}
	}
}
export namespace Guild {
	export interface Enabled extends Guild {
		guild: Discord.Guild;
		enabled: true;
		voiceMembers: string[];
		voiceChannel: Discord.VoiceBasedChannel;
		voiceChannelID: undefined;
		textChannel: GuildNonThreadTextBasedChannel;
		textChannelID: undefined;
	}
	export interface Disabled extends Guild {
		guild: null;
		enabled: false;
		voiceMembers: [];
		voiceChannel: undefined;
		voiceChannelID: string | undefined;
		textChannel: undefined;
		textChannelID: string | undefined;
	}
}

export default class ModuleData extends BaseData {
	readonly guilds: Map<string, Guild> = new Map();

	async initialize() {
		const json = this.getSavedFields();
		let needsSave = true;

		needsSave = !(await this.registerFieldMapAsync(json, "guilds", async(saved) => {
			for (const [guildID, rawGuildData] of Object.entries<Record<string, any>>(saved)) {
				const guildData = new Guild(null, rawGuildData.enabled === true, [], typeof rawGuildData.voiceChannelID === "string" ? rawGuildData.voiceChannelID : undefined, typeof rawGuildData.textChannelID === "string" ? rawGuildData.textChannelID : undefined);
				this.guilds.set(guildID, guildData);

				try {
					guildData.guild = await DiscordModule.client.guilds.fetch(guildID);
				}
				catch(error) {
					Module.log.error("Guild data disabled, because getting guild failed", {error, args: {guildID}});
					continue;
				}

				if (!guildData.enabled) continue;

				if (guildData.voiceChannelID) {
					try {
						const c = await guildData.guild.channels.fetch(guildData.voiceChannelID);
						if (!c)
						throw new Error(`Channel not found`);
						if (!c.isVoiceBased())
							throw new Error(`Channel is not voice based`);
						guildData.voiceChannel = c;
						guildData.voiceChannelID = undefined;
					}
					catch(error) {
						Module.log.error("Guild data disabled, because getting voice channel failed", {args: {
							guild: `${guildData.guild.name} (${guildData.guild.id})`,
							voiceChannelID: guildData.voiceChannelID
						}});
						guildData.enabled = false;
						continue;
					}
				}
				else {
					Module.log.error("Getting text channel failed: Not found, guild data will be disabled", {args: {
						guild: `${guildData.guild.name} (${guildData.guild.id})`
					}});
					guildData.enabled = false;
					continue;
				}

				if (guildData.textChannelID) {
					try {
						const c = await guildData.guild.channels.fetch(guildData.textChannelID);
						if (!c)
							throw new Error(`Channel not found`);
						if (!isGuildNonThreadTextBasedChannel(c))
							throw new Error(`Channel is not GuildNonThreadTextBased`);
						guildData.textChannel = c;
						guildData.textChannelID = undefined;
					}
					catch(error) {
						Module.log.error("Guild data disabled, because getting text channel failed", {error, args: {
							guild: `${guildData.guild.name} (${guildData.guild.id})`,
							textChannelID: guildData.textChannelID
						}});
						guildData.enabled = false;
						continue;
					}
				}
				else {
					Module.log.error("Getting text channel failed: ID is empty, guild data will be disabled", {args: {
						guild: `${guildData.guild.name} (${guildData.guild.id})`
					}});
					guildData.enabled = false;
					continue;
				}

				guildData.enabled = true;
			}
		}, async() => {
			const guilds: Record<string, any> = {};
			this.guilds.forEach((v, k) => guilds[k] = v.toJSON());
			return guilds;
		}));

		if (needsSave)
			this.save();
		return this;
	}

	getGuild(guild: string | Discord.Guild) {
		let guildID = typeof guild === "string" ? guild : guild.id;
		let guildData = this.guilds.get(guildID);
		if (!guildData) {
			guildData = new Guild(null, false, [], undefined, undefined);
			this.guilds.set(guildID, guildData);
			this.save();

			if (typeof guild === "string")
				DiscordModule.client.guilds.fetch(guildID).then(guild => Module.log.info("Initialized guild data", {args: {guild: `${guild.name} (${guild.id})`}}));
			else
				Module.log.info("Initialized guild data", {args: {guild: `${guild.name} (${guild.id})`}});
		}
		return guildData;
	}
}
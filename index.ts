import Core from "../../index.js";
import DiscordModule from "../ts-module-discord/index.js";
import Data, { type GuildNonThreadTextBasedChannel } from "./data.js";
import SlashCommandGet, { slashCommandGetName } from "./slash-commands/get.js";
import SlashCommandSet from "./slash-commands/set.js";

import * as Discord from "discord.js";

class DiscordGuildGuestTextChannelModule {
	readonly name = "discord-guild-guest-text-channel" as const;
	readonly data: Data;
	readonly log = Core.log.makeFunctions(this.name);

	constructor() {
		this.data = new Data(this);

		DiscordModule
			.once("addAuthorizationFields", a => a
				.addPermissions(Discord.PermissionFlagsBits.ManageChannels, Discord.PermissionFlagsBits.ReadMessageHistory, Discord.PermissionFlagsBits.UseApplicationCommands, Discord.PermissionFlagsBits.ViewChannel)
				.addIntents(Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildVoiceStates)
				.addPartials(Discord.Partials.Channel))
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		DiscordModule.slashCommands.push(SlashCommandGet(), SlashCommandSet());

		DiscordModule.client
			.once("shard0Ready", async() => {
				await this.data.initialize();
				this.onShard0Ready();
				DiscordModule.client.on("shard0Ready", () => this.onShard0Ready());
			}).on("guildCreate", guild => this.onGuildCreate(guild))
			.on("guildUpdate", guild => this.onGuildUpdate(guild))
			.on("guildDelete", guild => this.onGuildDelete(guild))
			.on("channelUpdate", (oldChannel, newChannel) => this.onChannelUpdate(oldChannel, newChannel))
			.on("channelDelete", channel => this.onChannelDelete(channel))
			.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
	}

	protected async onShard0Ready() {
		let save = false;
		for (const guildData of this.data.guilds.values()) {
			if (!guildData.isEnabled()) continue;
			if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, guildData.guild.id)) continue;

			if (guildData.voiceChannel.members.size > 0) {
				const previousMembers = guildData.voiceMembers.sort();
				const members = Array.from(guildData.voiceChannel.members.keys()).sort();

				// quit members
				for (const id of previousMembers.filter(id => !members.includes(id))) {
					let member;
					try {
						member = await guildData.guild.members.fetch(id);
					}
					catch(error) {
						this.log.error("Getting guild member failed", {error, args: {
							guild: `${guildData.guild.name} (${guildData.guild.id})`,
							user: `${(await DiscordModule.client.users.fetch(id)).username} (${id})`
						}});
						continue;
					}

					if (await this.lockChannel(guildData.textChannel, member))
						save = true;
				}

				// joined members
				for (const member of guildData.voiceChannel.members.filter(m => previousMembers.includes(m.id)).values()) {
					if (await this.unlockChannel(guildData.textChannel, member))
						save = true;
				}

				if (guildData.voiceMembers.join() === previousMembers.join()) {
					while (guildData.voiceMembers.length > 0) guildData.voiceMembers.pop();
					for (const id of previousMembers) guildData.voiceMembers.push(id);
					save = true;
				}
			}
		}
		if (save)
			this.data.save();
	}

	protected async onGuildCreate(guild: Discord.Guild) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, guild.id)) return;

		this.data.getGuild(guild);
	}

	protected async onGuildUpdate(guild: Discord.Guild) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, guild.id)) return;

		this.data.getGuild(guild).guild = guild;
	}

	protected async onGuildDelete(guild: Discord.Guild) {
		const guildData = this.data.guilds.get(guild.id);
		if (!guildData) return;

		if (guildData.isEnabled()) {
			guildData.disable();
			this.data.save();

			this.log.warn("Disabled guild data", {args: {
				guild: `${guild.name} (${guild.id})`,
				reason: "Discord bot was kicked/banned from guild"
			}});
		}
	}

	protected async onChannelUpdate(oldChannel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel, newChannel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel) {
		if (oldChannel.isDMBased() || newChannel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, newChannel.guild.id)) return;

		let guildData = this.data.getGuild(newChannel.guild);
		if (guildData && guildData.isEnabled()) {
			if (guildData.voiceChannel.id === newChannel.id) {
				if (newChannel.isVoiceBased())
					guildData.voiceChannel = newChannel;
				else {
					guildData = guildData.disable();
					while (guildData.voiceMembers.length > 0) guildData.voiceMembers.pop();
					guildData.voiceChannelID = undefined;
					this.data.save();

					this.log.warn("Disabled guild datad", {args: {
						guild: `${newChannel.guild.name} (${newChannel.guild.id})`,
						channel: `${newChannel.name} (${newChannel.id})`,
						reason: "Discord voice channel became not text based"
					}});
				}
			}
			else if (guildData.textChannel.id === newChannel.id) {
				if (newChannel.isTextBased())
					guildData.textChannel = newChannel;
				else {
					guildData = guildData.disable();
					guildData.textChannelID = undefined;
					this.data.save();

					this.log.warn("Disabled guild datad", {args: {
						guild: `${newChannel.guild.name} (${newChannel.guild.id})`,
						channel: `#${newChannel.name} (${newChannel.id})`,
						reason: "Discord text channel became not text based"
					}});
				}
			}
		}
	}

	protected async onChannelDelete(channel: Discord.DMChannel | Discord.NonThreadGuildBasedChannel) {
		if (channel.isDMBased()) return;
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, channel.guild.id)) return;

		let guildData = this.data.getGuild(channel.guild);
		if (guildData.isEnabled()) {
			if (guildData.voiceChannel.id === channel.id) {
				guildData = guildData.disable();
				while (guildData.voiceMembers.length > 0) guildData.voiceMembers.pop();
				guildData.voiceChannelID = undefined;
				this.data.save();

				this.log.warn("Disabled guild data", {args: {
					guild: `${channel.guild.name} (${channel.guild.id})`,
					channel: `#${channel.name} (${channel.id})`,
					reason: "Discord voice channel was deleted"
				}});
			}
			else if (guildData.textChannel.id === channel.id) {
				guildData = guildData.disable();
				guildData.textChannelID = undefined;
				this.data.save();

				this.log.warn("Disabled guild data", {args: {
					guild: `${channel.guild.name} (${channel.guild.id})`,
					channel: `#${channel.name} (${channel.id})`,
					reason: "Discord text channel was deleted"
				}});
			}
		}
		else {
			if (guildData.voiceChannelID && guildData.voiceChannelID === channel.id) {
				guildData = guildData.disable();
				while (guildData.voiceMembers.length > 0) guildData.voiceMembers.pop();
				guildData.voiceChannelID = undefined;
				this.data.save();

				this.log.warn("Removed discord voice channel id from guild data", {args: {
					guild: `${channel.guild.name} (${channel.guild.id})`,
					channel: `#${channel.name} (${channel.id})`,
					reason: "Channel was deleted"
				}});
			}
			if (guildData.textChannelID && guildData.textChannelID === channel.id) {
				guildData = guildData.disable();
				guildData.textChannelID = undefined;
				this.data.save();

				this.log.warn("Removed discord text channel id from guild data", {args: {
					guild: `${channel.guild.name} (${channel.guild.id})`,
					channel: `#${channel.name} (${channel.id})`,
					reason: "Channel was deleted"
				}});
			}
		}
	}

	protected async onVoiceStateUpdate(oldState: Discord.VoiceState, newState: Discord.VoiceState) {
		if (!DiscordModule.slashCommands.isCommandInGuildAllowed(slashCommandGetName, newState.guild.id)) return;

		const member = oldState.member ?? newState.member;
		if (!member) return;

		const guildData = this.data.getGuild(newState.guild.id);
		if (!guildData.isEnabled()) return;

		if (oldState.channelId === guildData.voiceChannel.id && newState.channelId !== guildData.voiceChannel.id) {
			if (await this.lockChannel(guildData.textChannel, member))
				this.data.save();
		}
		else if (newState.channelId === guildData.voiceChannel.id) {
			if (await this.unlockChannel(guildData.textChannel, member))
				this.data.save();
		}
	}

	/** @returns if `true`, needs to call `this.data.save()` */
	async unlockChannel(channel: GuildNonThreadTextBasedChannel, member: Discord.GuildMember) {
		let result = false;
		const guildData = this.data.getGuild(channel.guild.id);
		if (!guildData.isEnabled()) return result;

		if (channel.permissionOverwrites.cache.has(member.id)) return result;

		await channel.permissionOverwrites.create(member.id, {ViewChannel: true});

		if (!guildData.voiceMembers.includes(member.user.id)) {
			guildData.voiceMembers.push(member.user.id);
			guildData.voiceMembers.sort();
			result = true;
		}

		this.log.info("Unlocked guest text chat", {args: {
			guild: `${member.guild.name} (${member.guild.id})`,
			user: `${member.user.username} (${member.user.id})`
		}});
		return result;
	}

	/** @returns if `true`, needs to call `this.data.save()` */
	async lockChannel(channel: GuildNonThreadTextBasedChannel, member: Discord.GuildMember) {
		let result = false;
		const guildData = this.data.getGuild(channel.guild.id);
		if (!guildData.isEnabled()) return result;

		if (!channel.permissionOverwrites.cache.has(member.id)) return result;

		await channel.permissionOverwrites.delete(member.id);
		
		const index = guildData.voiceMembers.indexOf(member.user.id);
		if (index > -1) {
			guildData.voiceMembers.splice(index, 1);
			result = true;
		}

		this.log.info("Locked guest text chat", {args: {
			guild: `${member.guild.name} (${member.guild.id})`,
			user: `${member.user.username} (${member.user.id})`
		}});
		return result;
	}
}
export default new DiscordGuildGuestTextChannelModule();
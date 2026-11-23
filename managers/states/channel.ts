import Module from "../../index.js";
import type { ChannelStateManager } from "../channel.js";

import { type VoiceChannel, type GuildMember, PermissionFlagsBits, type PermissionOverwriteOptions } from "discord.js";

export interface ChannelStateSave {
	channelID: string;
	grantedPermissions?: Record<string, (keyof PermissionOverwriteOptions)[]>;
}

export class ChannelState {
	channel?: VoiceChannel;
	channelID: string;

	/** guild member ids */
	grantedPermissions: Map<string, (keyof PermissionOverwriteOptions)[]> = new Map();

	readonly manager: ChannelStateManager;
	constructor(manager: ChannelStateManager) {
		this.manager = manager;
	}

	isAvailable(): this is ChannelStateAvailable {
		return this.manager.state.isAvailable();
	}
	getChannelName() {
		return this.channel != null ? Module.discord.getChannelNameAndID(this.channel) : this.channelID;
	}

	/**
	 * **NOTE:** this method may set {@link Module.data.needsSave} to `true`

	 * **NOTE:** use this method only when {@link isAvailable()} returns `true`
	 */
	async lockForMember(member: GuildMember) {
		const granted = this.grantedPermissions.get(member.id);
		if (granted == null) return;
		const args: any = {
			guild: this.manager.state.getGuildName(),
			member: Module.discord.getGuildMemberNameAndID(member),
		};
		if (granted.length > 0) {
			await this.channel!.permissionOverwrites.edit(member, Object.fromEntries(granted.map(k => [k, null])));
			const overwrite = this.channel!.permissionOverwrites.cache.get(member.id);
			if (overwrite != null) {
				if (overwrite.allow.bitfield === 0n && overwrite.deny.bitfield === 0n) {
					await overwrite.delete();
					args.perms = null;
				}
				else {
					args.perms = {...overwrite.allow.serialize(), ...overwrite.deny.serialize()};
				}
			}
		}
		this.grantedPermissions.delete(member.id);
		Module.data.needsSave = true;
		Module.log.info("Locked guest voice channel", {args});
	}
	/**
	 * **NOTE:** this method may set {@link Module.data.needsSave} to `true`

	 * **NOTE:** use this method only when {@link isAvailable()} returns `true`
	 */
	async unlockForMember(member: GuildMember) {
		const missingPerms = this.channel!.permissionsFor(member).missing(Module.objectTypedKeys<keyof typeof Module.permissionsGuest>(Module.permissionsGuest).map(v => PermissionFlagsBits[v]));
		if (missingPerms.length < 1) return;

		await this.channel!.permissionOverwrites.edit(member.id, Object.fromEntries(Array.from(missingPerms.entries()).map(([v, k]) => [k, Module.permissionsGuest[k]])));
		this.grantedPermissions.set(member.id, missingPerms);
		Module.data.needsSave = true;
		Module.log.info("Unlocked guest voice channel", {args: {
			guild: this.manager.state.getGuildName(),
			member: Module.discord.getGuildMemberNameAndID(member),
			additionalPerms: missingPerms.join(", "),
		}});
	}
	async lockForEveryone() {
		for (const id of this.grantedPermissions.keys()) {
			const member = await this.manager.state.guild!.members.fetch(id);
			await this.lockForMember(member);
		}
	}
	async unlockForEveryone() {
		for (const id of this.grantedPermissions.keys()) {
			const member = await this.manager.state.guild!.members.fetch(id);
			await this.unlockForMember(member);
		}
	}
	/**
	 * **NOTE:** this method may set {@link Module.data.needsSave} to `true`

	 * **NOTE:** use this method only when {@link isAvailable()} returns `true`
	 */
	async updateLocks() {
		for (const id of this.channel!.members.keys())
			if (!this.grantedPermissions.has(id)) {
				const member = await this.manager.state.guild!.members.fetch(id);
				await this.unlockForMember(member);
			}

		for (const id of this.grantedPermissions.keys())
			if (!this.channel!.members.has(id)) {
				const member = await this.manager.state.guild!.members.fetch(id);
				await this.lockForMember(member);
			}
	}
	/** **NOTE:** this method may set {@link Module.data.needsSave} to `true` */
	async setChannelFromFetch() {
		this.channel = (await Module.discord.fetchChannelWithNotFoundHandling(this.manager.state.guild!, this.channelID) ?? undefined) as typeof this.channel;
		if (this.channel != null)
			await this.updateLocks();
		else
			this.manager.unset(this);
	}

	fromJSON(json: ChannelStateSave) {
		this.channelID = json.channelID;
		if (json.grantedPermissions) for (const [id, perms] of Object.entries(json.grantedPermissions))
			this.grantedPermissions.set(id, perms);
	}
	toJSON(): ChannelStateSave {
		return {
			channelID: this.channel?.id ?? this.channelID,
			grantedPermissions: this.grantedPermissions.size > 0 ? Object.fromEntries(this.grantedPermissions) : undefined,
		};
	}
}

export interface ChannelStateAvailable extends ChannelState {
	channel: VoiceChannel;
	channelID: string;
}
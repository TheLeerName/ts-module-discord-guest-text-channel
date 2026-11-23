import Module from "../index.js";
import { ChannelState, type ChannelStateSave, type ChannelStateAvailable } from "./states/channel.js";
import { type GuildState, type GuildStateAvailable } from "./states/guild.js";

import {
	type DMChannel,
	type NonThreadGuildBasedChannel,
	type VoiceState,
	type GuildMember,
} from "discord.js";

export type ChannelStateManagerSave = ChannelStateSave[];

export class ChannelStateManager extends Map<string, ChannelState> {
	readonly state: GuildState;
	constructor(state: GuildState) {
		super();
		this.state = state;
	}

	override get<_ChannelState extends ChannelState = ChannelState>(key: string) {
		return super.get(key) as _ChannelState | undefined;
	}
	override values<_ChannelState extends ChannelState = ChannelState>() {
		return super.values() as MapIterator<_ChannelState>;
	}

	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	async add(channel: ChannelStateAvailable["channel"]) {
		const state = new ChannelState(this);
		state.channel = channel;
		state.channelID = channel.id;
		this.set(state.channelID, state);
		await state.updateLocks();
		Module.data.needsSave = true;
	}
	/** **NOTE:** this method will set {@link Module.data.needsSave} to `true` */
	unset(state: ChannelState, reason?: string) {
		Module.log.warn(`Guild was disabled`, {causedBy: reason ?? `"channels.get('${state.channelID}')" was unset`, args: {
			guild: this.state.getGuildName(),
			channel: state.getChannelName(),
		}});
		this.delete(state.channelID);
		Module.data.needsSave = true;
	}

	fromJSON(array: ChannelStateManagerSave) {
		for (const save of array) {
			const state = new ChannelState(this);
			state.fromJSON(save);
			this.set(state.channelID, state);
		}
	}
	toJSON(): ChannelStateManagerSave {
		return Array.from(this.values()).map(g => g.toJSON());
	}

	async onGuildAvailable(state: GuildStateAvailable) {
		for (const channelState of this.values<ChannelStateAvailable>()) {
			await channelState.setChannelFromFetch();
		}
	}
	onChannelUpdate(oldChannel: DMChannel | NonThreadGuildBasedChannel, newChannel: DMChannel | NonThreadGuildBasedChannel) {
		const state = this.get(newChannel.id);
		if (state == null) return;

		state.channel = newChannel as typeof state.channel;
	}
	onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel) {
		const state = this.get(channel.id);
		if (state == null) return;

		this.unset(state, "Channel was deleted");
		Module.data.save(true);
	}
	async onVoiceStateUpdate(state: VoiceState & { channelId: string; member: GuildMember; }, isJoining: boolean) {
		const channelState = this.get(state.channelId);
		if (channelState == null) return;

		if (isJoining)
			await channelState.unlockForMember(state.member);
		else
			await channelState.lockForMember(state.member);
		await Module.data.save();
	}
}

export {
	ChannelState,
	type ChannelStateAvailable,
	type ChannelStateSave,
} from "./states/channel.js";
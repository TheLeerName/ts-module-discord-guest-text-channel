import * as Core from "../../index.js";
import { type Module as DiscordModule } from "../discord/index.js";
import { GuildStateManager } from "./managers/guild.js";
import SlashCommandAdd from "./slash-commands/add.js";
import SlashCommandGet from "./slash-commands/get.js";
import SlashCommandRemove from "./slash-commands/remove.js";

import {
	type PermissionOverwriteOptions,
	PermissionFlagsBits,
	GatewayIntentBits,
	Partials,
	type Guild,
} from "discord.js";

export class Module implements Core.IModule {
	readonly initializeBefore = ["discord"];
	readonly name = "discord-guest-voice-channel" as const;
	readonly data: Data;
	readonly log: Core.ModuleLogFunctions;
	readonly core: Core.Core;
	readonly discord: DiscordModule;
	readonly guilds: GuildStateManager;

	readonly permissionsGuest: PermissionOverwriteOptions = {ViewChannel: true};

	isAllowedInGuild(guild: Guild) {
		return this.discord.slashCommands.isCommandInGuildAllowed(SlashCommandGet().name, guild.id);
	}

	objectTypedKeys<Key extends string = string>(o: { [s: string]: unknown; }) {
		return Object.keys(o) as Key[];
	}

	async initialize() {
		//throw new Error("nope.");

		const discord = Core.default.modules.getInstance<DiscordModule>("discord");
		if (discord == null) return;

		Core.default.modules.setReadonlyFields(this, {
			data: new Data(this),
			core: Core.default,
			log: Core.default.log.makeFunctions(this.name),
			discord,
			guilds: new GuildStateManager(),
		});
		this.data.initialize();

		this.discord
			.addPermissions(PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ViewChannel)
			.addIntents(GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates)
			.addPartials(Partials.Channel)
			.once("afterClientCreation", () => this.afterDiscordClientCreation());
	}

	protected afterDiscordClientCreation() {
		SlashCommandAdd();
		SlashCommandGet();
		SlashCommandRemove();
		this.guilds.registerDiscordCallbacks();
	}
}

export class Data extends Core.BaseData {
	/** If this `true`, next call of {@link save()} will save data */
	needsSave = false;

	protected module: Module;

	initialize() {
		const json = this.getSavedFields();
		this.needsSave = true;

		this.needsSave = this.registerFieldArray(json, "guilds",
			savedValue => this.module.guilds.fromJSON(savedValue),
			() => this.module.guilds.toJSON(),
		);

		this.save();
		return this;
	}

	async save(force?: boolean) {
		if (force || this.needsSave) {
			await super.save();
			this.needsSave = false;
		}
	}
}

export default new Module();

export * from "./managers/guild.js";
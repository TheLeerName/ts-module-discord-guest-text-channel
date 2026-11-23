import Module from "../index.js";
import type { ChannelStateAvailable } from "../managers/channel.js";
import { EmbedBuilder } from "discord.js";

/** That command name used for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export default () => Module.discord.slashCommands.make("guest-channels-get", c => c
.setVersion(1)
.setType("guild")
.setDescription(`Sends all guest voice channels`)
.setDescriptionLocalization("ru", `Отправляет все гостевые голосовые каналы`)
.setChatInput(async(interaction) => {
	const start = Date.now();
	await interaction.deferReply();

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try {
		const state = Module.guilds.createAndGet(interaction.guild);
		await Module.data.save();

		const channels = Array.from(state.channels.values<ChannelStateAvailable>());
		args.channels = channels.length > 0 ? channels.map(s => Module.discord.getChannelNameAndID(s.channel)).join(", ") : undefined;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:notepad_spiral: Все гостевые голосовые каналы`)
			.setDescription(channels.length > 0 ? channels.map((s, i) => `${i + 1}. <#${s.channel.id}>: ${s.channel.members.size}${s.channel.userLimit === 0 ? "" : ` из ${s.channel.userLimit}`} участников`).join("\n") : "*пусто*")
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});
		Module.log.info(`Command ${interaction.commandName} success`, {args});
	}
	catch(error) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});

		Module.log.error(`Command ${interaction.commandName} failed`, {error, args});
	}
}));
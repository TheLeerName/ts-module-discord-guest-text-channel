import Core from "../../../index.js";
import Module from "../index.js";
import { SlashCommand } from "../../ts-module-discord/index.js";

import * as Discord from "discord.js";

/** That command name uses for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export const slashCommandGetName = "guest-text-channel-get";

export default () => new SlashCommand()
.setVersion(2)
.setCooldown(5000)
.setName(slashCommandGetName)
.setDescription(`Sends "${Module.name}" module parameters of this server`)
.setDescriptionLocalization("ru", `Отправляет параметры модуля "${Module.name}" этого сервера`)
.setChatInput(async(interaction) => {
	if (!interaction.inCachedGuild()) return;

	const start = Date.now();
	await interaction.deferReply();

	const args: any = {
		guild: `${interaction.guild.name} (${interaction.guild.id})`,
		user: `${interaction.user.username} (${interaction.user.id})`
	};
	try {
		const guildData = Module.data.getGuild(interaction.guild.id);

		args.voiceChannel = guildData.voiceChannel ? `<#${guildData.voiceChannel.id}>` : `*не установлено*`;
		args.textChannel = guildData.voiceChannel ? `<#${guildData.voiceChannel.id}>` : `*не установлено*`;
		args.voiceMembers = guildData.voiceMembers;
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:notepad_spiral: Параметры модуля "${Module.name}" этого сервера`)
			.setFields(
				{
					name: "Голосовой канал для отслеживания",
					value: args.voiceChannel
				},
				{
					name: "Текстовый канал для открытия/закрытия",
					value: args.textChannel
				}
			)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
		]});
		Module.log.info(`Command ${interaction.commandName} success`, {args});
	}
	catch(error) {
		await interaction.editReply({embeds: [new Discord.EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
		]});

		Module.log.error(`Command ${interaction.commandName} failed`, {error, args});
	}
});
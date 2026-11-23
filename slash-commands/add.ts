import Module from "../index.js";
import { EmbedBuilder, ChannelType } from "discord.js";

export default () => Module.discord.slashCommands.make("guest-channels-add", c => {c
.setVersion(1)
.setType("guild")
.setDescription(`Adds guest voice channel: when user moved to this channel, they gain some permissions`)
.setDescriptionLocalization("ru", `Добавляет гостевой голосовой канал: когда юзер заходит в этот канал, он получает права видеть его`)
.setChatInput(async(interaction) => {
	const start = Date.now();
	await interaction.deferReply();

	const channel = interaction.options.getChannel<ChannelType.GuildVoice>("channel", true);

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try {
		args.channel = Module.discord.getChannelNameAndID(channel);

		const state = Module.guilds.createAndGet(interaction.guild);
		await state.channels.add(channel);
		await Module.data.save();
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Успешно!`)
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
});
c.addChannelOption(o => o
	.setName("channel")
	.setDescription("Guest voice channel")
	.setDescriptionLocalization("ru", "Гостевой голосовой канал")
	.addChannelTypes(ChannelType.GuildVoice)
	.setRequired(true)
);
return c});
import Module from "../index.js";
import { EmbedBuilder, ChannelType } from "discord.js";

/** That command name used for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export default () => Module.discord.slashCommands.make("guest-channels-remove", c => {c
.setVersion(1)
.setType("guild")
.setDescription(`Removes guest voice channel`)
.setDescriptionLocalization("ru", `Удаляет гостевой голосовой канал`)
.setAutocomplete(async(interaction) => {
	const state = Module.guilds.get(interaction.guildId);
	if (state != null) {
		const focused = interaction.options.getFocused();
		await interaction.respond(Array.from(state.channels.values()).sort((a, b) => a.channel!.name.indexOf(focused) - b.channel!.name.indexOf(focused)).slice(0, 10).map(s => {return{name: s.channel!.name, value: s.channel!.id}}));
	}
})
.setChatInput(async(interaction) => {
	const start = Date.now();
	await interaction.deferReply();

	const channel = interaction.options.getChannel<ChannelType.GuildVoice>("channel", true);

	const args: any = {
		guild: Module.discord.getGuildNameAndID(interaction.guild),
		member: Module.discord.getGuildMemberNameAndID(interaction.member),
	};
	try	{
		args.channel = Module.discord.getChannelNameAndID(channel);

		const state = Module.guilds.createAndGet(interaction.guild);
		state.channels.delete(channel.id);
		Module.data.needsSave = true;
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:white_check_mark: Успешно!`)
			.setColor("#77b255")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});
		Module.log.info(`Command ${c.name} success`, {args});
	}
	catch(error) {
		await interaction.editReply({embeds: [new EmbedBuilder()
			.setTitle(`:x: Ошибка!`)
			.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
			.setColor("#dd2e44")
			.setFooter({text: `Время обработки: ${Module.core.humanizeDuration(Date.now() - start)}`})
		]});

		Module.log.error(`Command ${c.name} failed`, {error, args});
	}
	finally {
		Module.data.save();
	}
});
c.addStringOption(o => o
	.setName("channel")
	.setDescription("Guest voice channel")
	.setDescriptionLocalization("ru", "Гостевой голосовой канал")
	.setMinLength(17)
	.setRequired(true)
	.setAutocomplete(true)
);
return c});
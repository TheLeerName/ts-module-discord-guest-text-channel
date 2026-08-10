import Core from "../../../index.js";
import Module from "../index.js";
import { GuildNonThreadTextBasedChannelTypes } from "../data.js";
import { SlashCommand } from "../../ts-module-discord/index.js";

import * as Discord from "discord.js";

export default () => {
	const c = new SlashCommand()
	.setVersion(2)
	.setCooldown(5000)
	.setName("guest-text-channel-set")
	.setDescription(`Changes "${Module.name}" module parameters of this server`)
	.setDescriptionLocalization("ru", `Изменяет параметры модуля "${Module.name}" этого сервера`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const voiceChannel = interaction.options.getChannel<Discord.ChannelType.GuildVoice>("voice-channel");
		const textChannel = interaction.options.getChannel<Discord.ChannelType.GuildText>("text-channel");

		const args: any = {
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		};
		try	{
			const guildData = Module.data.getGuild(interaction.guild);
			if (guildData.textChannel) {
				for (const id of guildData.voiceMembers) {
					let member;
					try {
						member = await interaction.guild.members.fetch(id);
					}
					catch(error) {
						Module.log.error("Getting guild member failed", {error, args: {
							guild: `${interaction.guild.name} (${interaction.guild.id})`,
							user: `${(await interaction.client.users.fetch(id)).username} (${id})`
						}});
						continue;
					}

					await Module.lockChannel(guildData.textChannel, member);
				}
			}

			guildData.voiceChannel = voiceChannel ?? undefined;
			guildData.textChannel = textChannel ?? undefined;
			if (guildData.voiceChannel && guildData.textChannel) {
				guildData.guild = interaction.guild;
				guildData.enabled = true;
				if (guildData.voiceChannel.members.size > 0) {
					for (const member of guildData.voiceChannel.members.values())
						await Module.unlockChannel(guildData.textChannel, member);
				}
			}
			else {
				guildData.guild = null;
				guildData.enabled = false;
			}

			args.voiceChannel = guildData.voiceChannel ? `${guildData.voiceChannel.name} (${guildData.voiceChannel.id})` : guildData.voiceChannelID ?? guildData.voiceChannel;
			args.textChannel = guildData.textChannel ? `#${guildData.textChannel.name} (${guildData.textChannel.id})` : guildData.textChannelID ?? guildData.textChannel;
			args.voiceMembers = guildData.voiceMembers;
			args.enabled = guildData.enabled;

			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});
			Module.log.info(`Command ${c.name} success`, {args});
		}
		catch(error) {
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:x: Ошибка!`)
				.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});

			Module.log.error(`Command ${c.name} failed`, {error, args});
		}
		finally {
			Module.data.save();
		}
	});
	c.addChannelOption(option => option
		.setName("voice-channel")
		.setDescription("Voice channel which will be tracked for joined/left members")
		.setDescriptionLocalization("ru", "Голосовой канал который будет отслеживаться на наличие зашедших/вышедших участников гс")
		.addChannelTypes(Discord.ChannelType.GuildVoice)
	).addChannelOption(option => option
		.setName("text-channel")
		.setDescription(`Text channel which will be unlocked/locked for joined/left members`)
		.setDescriptionLocalization("ru", `Текстовый канал который будет закрываться/открываться для зашедших/вышедших участников гс`)
		.addChannelTypes(...GuildNonThreadTextBasedChannelTypes)
	);
	return c;
};
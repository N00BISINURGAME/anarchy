const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers } = require('../config.json');

const messageOption = new SlashCommandStringOption()
    .setName("description")
    .setDescription("The description of your QBB")

const linkOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("link")
    .setDescription("The link to your QBB.")

const player1Option = new SlashCommandUserOption()
    .setRequired(true)
    .setName("player-1")
    .setDescription("Player 1")

const player2Option = new SlashCommandUserOption()
    .setRequired(true)
    .setName("player-2")
    .setDescription("Player 2")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qbb')
        .setDescription('Posts a QBB game')
        .addUserOption(player1Option)
        .addUserOption(player2Option)
        .addStringOption(linkOption)
        .addStringOption(messageOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id

        const message = interaction.options.getString("description")
        const link = interaction.options.getString("link")

        const player1 = interaction.options.getMember("player-1")
        if (!player1) {
            await db.close()
            return interaction.editReply({ content:"Player 1 may have left the server! Ensure they are in the server and try again.", ephemeral:true })
        }
        const player2 = interaction.options.getMember("player-2")
        if (!player2) {
            await db.close()
            return interaction.editReply({ content:"Player 2 may have left the server! Ensure they are in the server and try again.", ephemeral:true })
        }

        const regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/

        const matches = link.match(regex)

        if (!matches) {
            await db.close()
            return interaction.editReply({ content:"The link you provided may not be valid! Ensure it is a valid QBB link. Feel free to DM Donovan#3771 with any questions.", ephemeral:true })
        }

        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        const manager = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user, guild])

        if (!(admin || manager)) {
          await db.close()
          return interaction.editReply({ content:"You are not authorized to run this command!", ephemeral: true})
        }

        const channelSql = await db.get('SELECT channelid FROM Channels WHERE purpose = "pickups-qbbs" AND guild = ?', guild)
        if (!channelSql) {
          await db.close()
          return interaction.editReply({ content:"The pickup & QBB channel has not been set! This can be set by running /channel.", ephemeral: true})
        }
        const channel = await interaction.guild.channels.fetch(channelSql.channelid)

        const embed = new EmbedBuilder()
          .setTitle("Quarterback battle!")
          .setColor([0, 0, 0])
          .setDescription(`A Quarterback battle is being hosted right now! To join, click the button at the bottom of this message!
          \n>>> **Players:** ${player1} \`${player1.user.tag}\` vs ${player2} \`${player2.user.tag}\`\n**Staff member:** ${interaction.member} \`${interaction.user.tag}\`${message ? `\n**Description:** ${message}` : ""}`)

        if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        if (interaction.user.avatarURL()) {
          embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
          embed.setFooter({ text: `${interaction.user.tag}` })
        }

        let button = new ActionRowBuilder()
			.addComponents(new ButtonBuilder()
					.setLabel("Join our support server!")
					.setStyle(ButtonStyle.Link)
					.setURL(`${link}`))

        await interaction.editReply({ content:"Successfully posted QBB!", ephemeral: true})

        await channel.send({ embeds:[embed], components:[button] })

        await db.close();
    }
}

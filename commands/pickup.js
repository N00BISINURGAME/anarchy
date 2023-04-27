const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandRoleOption, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers } = require('../config.json');

const messageOption = new SlashCommandStringOption()
    .setName("description")
    .setDescription("The description of your pickup. This is optional.")

const linkOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("link")
    .setDescription("The link to your pickup.")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pickup')
        .setDescription('Posts a pickup game')
        .addStringOption(linkOption)
        .addStringOption(messageOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id

        const message = interaction.options.getString("description")
        const link = interaction.options.getString("link")

        const regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/

        const matches = link.match(regex)

        if (!matches) {
            await db.close()
            return interaction.editReply({ content:"The link you provided may not be valid! Ensure it is a valid pickup link. Feel free to DM Donovan#3771 with any questions.", ephemeral:true })
        }

        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        const manager = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user, guild])

        if (!(admin || manager)) {
          await db.close()
          return interaction.editReply({ content:"You are not authorized to run this command!", ephemeral: true})
        }

        const channelSql = await db.get('SELECT channelid FROM Channels WHERE purpose = "pickup-qbb" AND guild = ?', guild)
        if (!channelSql) {
          await db.close()
          return interaction.editReply({ content:"The pickup & QBB channel has not been set!", ephemeral: true})
        }
        const channel = await interaction.guild.channels.fetch(channelSql.channelid)

        const embed = new EmbedBuilder()
          .setTitle("Pickup game!")
          .setColor([0, 0, 0])
          .setDescription(`A pickup game is being hosted right now! To join, click the button at the bottom of this message!
          \n>>> **Staff member:** ${interaction.member} (${interaction.user.tag})${message ? `\n**Description:** ${message}` : ""}`)

        let button = new ActionRowBuilder()
          .addComponents(new ButtonBuilder()
                  .setLabel("Join the pickup!")
                  .setStyle(ButtonStyle.Link)
                  .setURL(`${link}`))
        if (interaction.guild.iconURL()) {
            embed.setThumbnail(logoSql.logo)
        }

        if (interaction.user.avatarURL()) {
          embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
          embed.setFooter({ text: `${interaction.user.tag}` })
        }

        await interaction.editReply({ content:"Successfully posted pickup game!", ephemeral: true})



        await channel.send({ embeds:[embed], components:[button] })

        await db.close();
    }
}

const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandRoleOption, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers } = require('../config.json');

const messageOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("description")
    .setDescription("The description of your LFP post")

const linkOption = new SlashCommandStringOption()
    .setName("link")
    .setDescription("The link to your tryout, if any. This is optional.")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lfp')
        .setDescription('Posts a LFP message')
        .addStringOption(messageOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id

        const message = interaction.options.getString("description")

        let authorized = false
        let teamRole;
        for (const role of interaction.member.roles.cache.keys()) {
          if (authorized && teamRole) break;
          const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
          if (roleExists) {
            if (roleExists.code === "FO" || roleExists.code === "GM" || roleExists.code === "HC") {
              authorized = true
            } else if (!(roleExists.code === "FO" || roleExists.code === "GM" || roleExists.code === "HC")) {
              teamRole = roleExists
            }
          }
        }

        if (!teamRole) {
          await db.close()
          return interaction.editReply({ content:"The team you are on is not in the database! This may indicate you need to run /setup.", ephemeral: true})
        }

        if (!authorized) {
          await db.close()
          return interaction.editReply({ content:"You are not authorized to run this command!", ephemeral: true})
        }

        const logoSql = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [teamRole.code, guild])

        const channelSql = await db.get('SELECT channelid FROM Channels WHERE purpose = "lfp" AND guild = ?', guild)
        if (!channelSql) {
          await db.close()
          return interaction.editReply({ content:"The LFP channel has not been set!", ephemeral: true})
        }
        const channel = await interaction.guild.channels.fetch(channelSql.channelid)

        const role = await interaction.guild.roles.fetch(teamRole.roleid)

        const embed = new EmbedBuilder()
          .setTitle("Looking for Players")
          .setColor(role.color)
          .setDescription(`The ${role} are looking for players!
          \n>>> **Coach:** ${interaction.member} (${interaction.user.tag})\n**Description:** ${message}`)
          .setThumbnail(logoSql.logo)
        
        if (interaction.user.avatarURL()) {
          embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
          embed.setFooter({ text: `${interaction.user.tag}` })
        }

        await interaction.editReply({ content:"Successfully posted LFP!", ephemeral: true})

        await channel.send({ embeds:[embed] })

        await db.close();
    }
}

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
        .addStringOption(messageOption)
        .addStringOption(linkOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id

        const message = interaction.options.getString("description")
        const link = interaction.options.getString("link")

        const authorized = await db.get('SELECT * FROM Players WHERE role != "P" AND guild = ? AND discordid = ?',[guild, user])
        if (!authorized) {
          await db.close()
          return interaction.editReply({ content:"You are not authorized to run this command!", ephemeral: true})
        }

        const logoSql = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [authorized.team, guild])

        const channelSql = await db.get('SELECT channelid FROM Channels WHERE purpose = "lfp" AND guild = ?', guild)
        if (!channelSql) {
          await db.close()
          return interaction.editReply({ content:"The LFP channel has not been set!", ephemeral: true})
        }
        const channel = await interaction.guild.channels.fetch(channelSql.channelid)

        const roleQuery = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [authorized.team, guild])

        const role = await interaction.guild.roles.fetch(roleQuery.roleid)

        const embed = new EmbedBuilder()
          .setTitle("Looking for Players")
          .setDescription(`The ${role} are looking for players!`)
          .setThumbnail(logoSql.logo)
          .addFields(
            { name:"Coach", value:`${interaction.member}\n${interaction.user.tag}` },
            { name:"Description", value:`${message}`}
          )

        if (link) {
          embed.addFields(
            { name:"Link", value:`${link}`}
          )
        }

        await interaction.editReply({ content:"Successfully posted LFP!", ephemeral: true})

        await channel.send({ embeds:[embed] })

        await db.close();
    }
}

const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandAttachmentOption, SlashCommandRoleOption } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require("../config.json")

const linkOption = new SlashCommandAttachmentOption().setRequired(true).setName("logo").setDescription("An attachment to the logo")
const teamOption = new SlashCommandRoleOption().setRequired(true).setName("team").setDescription("The team whose logo you want to change")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logo')
        .addRoleOption(teamOption)
        .addAttachmentOption(linkOption)
        .setDescription('Changes the logo of the specified team'),
    async execute(interaction) {
        const db = await getDBConnection();
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, interaction.guild.id])
        if (!authorized) {
            await db.close()
          return interaction.editReply({ content:"You are not authorized to change the team's logo!", ephemeral:true })
        }

        // first, get player stats
        const link = interaction.options.getString('logo')
        const team = interaction.options.getRole('team')
        const guild = interaction.guild.id

        if (!link.contentType.includes("image")) {
            await db.close()
            return interaction.editReply({ content:"The logo you submitted is not a valid image! Ensure you attach a valid image and try again.", ephemeral:true })
        }

        const code = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [team.id, guild])
        if (!code) {
            await db.close()
            return interaction.editReply({ content:"The team you want to change the logo of does not exist in the database! This may indicate that you need to run /setup.", ephemeral:true })
        }

        await db.run('UPDATE Teams SET logo = ? WHERE code = ? AND guild = ?', [link.url, code.code, guild])

        await db.close()
        return interaction.editReply({ content:`Successfully changed logo!`, ephemeral:true })
    }
}
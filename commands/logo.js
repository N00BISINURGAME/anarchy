const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandRoleOption } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require("../config.json")

const linkOption = new SlashCommandStringOption().setRequired(true).setName("link").setDescription("The link to the logo")
const teamOption = new SlashCommandRoleOption().setRequired(true).setName("team").setDescription("The team whose logo you want to change")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logo')
        .addRoleOption(teamOption)
        .addStringOption(linkOption)
        .setDescription('Changes the logo of the specified team'),
    async execute(interaction) {
        if (!admins.includes(interaction.user.id)) {
          return interaction.editReply({ content:"You are not authorized to change the team's logo!", ephemeral:true })
        }
        const db = await getDBConnection();

        // first, get player stats
        const link = interaction.options.getString('link')
        const team = interaction.options.getRole('team')
        const guild = interaction.guild.id

        const code = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [team.id, guild])

        await db.run('UPDATE Teams SET logo = ? WHERE code = ? AND guild = ?', [link, code.code, guild])
        
        await db.close()
        return interaction.editReply({ content:`Successfully changed logo!`, ephemeral:true })
    }
}
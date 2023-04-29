const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandRoleOption, SlashCommandAttachmentOption } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require("../config.json")

const yourTeamOption = new SlashCommandRoleOption().setRequired(true).setName('your-team').setDescription('The role corresponding to your team')
const yourTeamScoreOption = new SlashCommandIntegerOption().setRequired(true).setName('your-team-score').setDescription('Your teams score')
const otherTeamOption = new SlashCommandRoleOption().setRequired(true).setName('other-team').setDescription('The role corresponding to the other team')
const otherTeamScoreOption = new SlashCommandIntegerOption().setRequired(true).setName('other-team-score').setDescription('The other teams score')
const qbStatsOption = new SlashCommandAttachmentOption().setRequired(true).setName('qb-stats').setDescription('QB Stats')
const rbStatsOption = new SlashCommandAttachmentOption().setRequired(true).setName('rb-stats').setDescription('RB Stats')
const wrStatsOption = new SlashCommandAttachmentOption().setRequired(true).setName('wr-stats').setDescription('WR Stats')
const defStatsOption = new SlashCommandAttachmentOption().setRequired(true).setName('def-stats').setDescription('Defense Stats')
const kStatsOption = new SlashCommandAttachmentOption().setRequired(true).setName('k-stats').setDescription('K Stats')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poststats')
        .addRoleOption(yourTeamOption)
        .addIntegerOption(yourTeamScoreOption)
        .addRoleOption(otherTeamOption)
        .addIntegerOption(otherTeamScoreOption)
        .addAttachmentOption(qbStatsOption)
        .addAttachmentOption(rbStatsOption)
        .addAttachmentOption(wrStatsOption)
        .addAttachmentOption(defStatsOption)
        .addAttachmentOption(kStatsOption)
        .setDescription('Posts game statistics into a specific channel'),
    async execute(interaction) {
        const db = await getDBConnection();
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, interaction.guild.id])
        if (!authorized) {
            await db.close()
          return interaction.editReply({ content:"You are not authorized to change the team's logo!", ephemeral:true })
        }

        // first, get player stats
        const link = interaction.options.getAttachment('qb-stats')
        
        console.log(link.contentType)

        await db.close()
        return interaction.editReply({ content:`Successfully changed logo!`, ephemeral:true })
    }
}
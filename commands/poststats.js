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
        const guild = interaction.guild.id

        const statsChannel = await db.get("SELECT channelid FROM Channels WHERE purpose = ? AND guild = ?", ["stats", guild]);
        if (!statsChannel) {
            await db.close()
            return interaction.editReply({ content:"A stats channel has not been set! You can set a channel for stats by running /channel.", ephemeral:true })
        }
        let authorized = false;
        for (const role of interaction.member.roles.cache.keys()) {
          const auth = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
          if (auth.code === "FO" || auth.code === "GM" || auth.code === "HC") {
            authorized = true;
            break;
          }
        }

        if (!authorized) {
          await db.close()
          return interaction.editReply({ content:"You are not authorized to post stats!", ephemeral:true })
        }

        // first, get player stats
        const team1 = interaction.options.getRole("your-team")
        const team1Score = interaction.options.getInteger('your-team-score')
        const team2 = interaction.options.getRole("other-team")
        const team2Score = interaction.options.getInteger('other-team-score')
        const qbStats = interaction.options.getAttachment('qb-stats')
        if (!qbStats.includes("image")) {
          await db.close()
          return interaction.editReply({ content:"The QB stats you submitted are not a valid image! Ensure you attach a valid image and try again.", ephemeral:true })
        }

        const rbStats = interaction.options.getAttachment('rb-stats')
        if (!rbStats.includes("image")) {
          await db.close()
          return interaction.editReply({ content:"The RB stats you submitted are not a valid image! Ensure you attach a valid image and try again.", ephemeral:true })
        }

        const wrStats = interaction.options.getAttachment('wr-stats')
        if (!wrStats.includes("image")) {
          await db.close()
          return interaction.editReply({ content:"The WR stats you submitted are not a valid image! Ensure you attach a valid image and try again.", ephemeral:true })
        }

        const defStats = interaction.options.getAttachment('def-stats')
        if (!defStats.includes("image")) {
          await db.close()
          return interaction.editReply({ content:"The defensive stats you submitted are not a valid image! Ensure you attach a valid image and try again.", ephemeral:true })
        }

        const kStats = interaction.options.getAttachment('k-stats')
        if (!kStats.includes("image")) {
          await db.close()
          return interaction.editReply({ content:"The K stats you submitted are not a valid image! Ensure you attach a valid image and try again.", ephemeral:true })
        }

        const channel = await interaction.guild.channels.fetch(statsChannel.channelid)
        
        if (team1Score > team2Score) {
          await channel.send(`${qbStats.url}\n${rbStats.url}\n${wrStats.url}\n${defStats.url}\n${kStats.url}\n${team1} ${team1Score} - ${team2Score} ${team2}\nStats posted by ${interaction.member} (${interaction.user.tag})`)
        } else {
          await channel.send(`${qbStats.url}\n${rbStats.url}\n${wrStats.url}\n${defStats.url}\n${kStats.url}\n${team2} ${team2Score} - ${team1Score} ${team1}\nStats posted by ${interaction.member} (${interaction.user.tag})`)
        }

        await db.close()
        return interaction.editReply({ content:`Successfully posted stats!`, ephemeral:true })
    }
}
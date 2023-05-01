const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const attemptsOption = new SlashCommandIntegerOption().setRequired(true).setName('attempts').setDescription("The number of attempted kicks you have");
const goodOption = new SlashCommandIntegerOption().setRequired(true).setName('good-kicks').setDescription("The number of good kicks you've made");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kickerstats')
        .addIntegerOption(attemptsOption)
        .addIntegerOption(goodOption)
        .setDescription('Records a players kicker stats for use in a statsheet.'),
    async execute(interaction) {
        const db = await getDBConnection();

        

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id
        const attempts = interaction.options.getInteger('attempts')
        const good = interaction.options.getInteger('good-kicks')
        const { season } = await db.get('SELECT season FROM Leagues WHERE guild = ?', guild)

        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        const manager = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        if (!(admin || manager)) {
            await db.close()
            return interaction.editReply({ content:"You are not permitted to run this command!", ephemeral:true })
        }

        let average = good / attempts
        average = Math.round(average * 10) / 10

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM KStats WHERE discordid = ? AND guild = ? AND season = ?", [userid, guild, season]);
        if (!playerExists) {
            await db.run("INSERT INTO KStats (discordid, guild, attempts, good_kicks, season) VALUES (?, ?, ?, ?, ?)", [userid, guild, 0, 0, season])
        } 
        await db.run("UPDATE KStats SET attempts = attempts + ?, good_kicks = good_kicks + ? WHERE discordid = ? AND guild = ? AND season = ?", [attempts, good, userid, guild, season])
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded kicker stats!`, ephemeral:true })
    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const attemptsOption = new SlashCommandIntegerOption().setRequired(true).setName('attempts').setDescription("The number of runs you've attempted");
const tdOption = new SlashCommandIntegerOption().setRequired(true).setName('touchdowns').setDescription("The number of touchdowns you've rushed for");
const yardsOption = new SlashCommandIntegerOption().setRequired(true).setName('yards').setDescription("The number of yards you've rushed for");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rbstats')
        .addIntegerOption(attemptsOption)
        .addIntegerOption(tdOption)
        .addIntegerOption(yardsOption)
        .setDescription('Records your all-time RB stats.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id;
        const attempts = interaction.options.getInteger('attempts')
        const tds = interaction.options.getInteger('touchdowns')
        const yards = interaction.options.getInteger('yards')

        let average = yards / attempts
        average = Math.round(average * 10) / 10

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM RBStats WHERE discordid = ? AND guild = ?", [userid, guild]);
        if (!playerExists) {
            await db.run("INSERT INTO RBStats (discordid, guild, average, attempts, touchdowns, yards) VALUES (?, ?, ?, ?, ?)", [userid, guild, 0, 0, 0, 0])
        } 
        await db.run("UPDATE RBStats SET attempts = attempts + ?, touchdowns = touchdowns + ?, yards = yards + ?, WHERE discordid = ? AND guild = ?", [attempts, tds, yards, userid, guild])
        await db.run("UPDATE RBStats SET average = yards / attempts WHERE discordid = ? AND guild = ?", [userid, guild])
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded RB stats!`, ephemeral:true })
    }
}
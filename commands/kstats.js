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
        .setDescription('Records your all-time kicker stats.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id
        const attempts = interaction.options.getInteger('attempts')
        const good = interaction.options.getInteger('good-kicks')

        let average = good / attempts
        average = Math.round(average * 10) / 10

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM KStats WHERE discordid = ?", userid);
        if (!playerExists) {
            await db.run("INSERT INTO KStats (discordid, guild, attempts, good_kicks) VALUES (?, ?, ?)", [userid, guild, 0, 0])
        } else {
            await db.run("UPDATE KStats SET attempts = ?, good_kicks = ? WHERE discordid = ?", [attempts, good, userid])
        }
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded kicker stats!`, ephemeral:true })
    }
}
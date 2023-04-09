const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const completionsOption = new SlashCommandIntegerOption().setRequired(true).setName('completions').setDescription("The number of passes you've completed");
const attemptsOption = new SlashCommandIntegerOption().setRequired(true).setName('attempts').setDescription("The number of passes you've attempted");
const tdOption = new SlashCommandIntegerOption().setRequired(true).setName('touchdowns').setDescription("The number of touchdowns you've thrown");
const intOption = new SlashCommandIntegerOption().setRequired(true).setName('interceptions').setDescription("The number of interceptions you've thrown");
const yardsOption = new SlashCommandIntegerOption().setRequired(true).setName('yards').setDescription("The number of yards you've thrown");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qbstats')
        .addIntegerOption(completionsOption)
        .addIntegerOption(attemptsOption)
        .addIntegerOption(tdOption)
        .addIntegerOption(intOption)
        .addIntegerOption(yardsOption)
        .setDescription('Records your all-time QB stats.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const completions = interaction.options.getInteger('completions')
        const attempts = interaction.options.getInteger('attempts')
        const tds = interaction.options.getInteger('touchdowns')
        const ints = interaction.options.getInteger('interceptions')
        const yards = interaction.options.getInteger('yards')

        const a = Math.max(0, Math.min(((completions / attempts) - 0.3) * 5, 2.375))
        const b = Math.max(0, Math.min(((yards / attempts) - 3) * 0.25, 2.375))
        const c = Math.max(0, Math.min((tds / attempts) * 20, 2.375))
        const d = Math.max(0, Math.min(2.375 - ((ints / attempts) * 25), 2.375))

        let passerRating = ((a + b + c + d) / 6) * 100
        passerRating = Math.round(passerRating * 10) / 10

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM QBStats WHERE discordid = ?", userid);
        if (!playerExists) {
            await db.run("INSERT INTO QBStats(discordid, passer_rating, completions, attempts, touchdowns, yards, interceptions) VALUES (?, ?, ?, ?, ?, ?, ?)", [userid, passerRating, completions, attempts, tds, yards, ints])
        } else {
            await db.run("UPDATE QBStats SET passer_rating = ?, completions = ?, attempts = ?, touchdowns = ?, yards = ?, interceptions = ? WHERE discordid = ?", [passerRating, completions, attempts, tds, yards, ints, userid])
        }
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded QB stats!`, ephemeral:true })
    }
}
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
        const guild = interaction.guild.id;
        const completions = interaction.options.getInteger('completions')
        const attempts = interaction.options.getInteger('attempts')
        const tds = interaction.options.getInteger('touchdowns')
        const ints = interaction.options.getInteger('interceptions')
        const yards = interaction.options.getInteger('yards')

        

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM QBStats WHERE discordid = ? AND guild = ?", [userid, guild]);
        if (!playerExists) {
            await db.run("INSERT INTO QBStats(discordid, guild, passer_rating, completions, attempts, touchdowns, yards, interceptions) VALUES (?, ?, ?, ?, ?, ?, ?)", [userid, guild, 0, 0, 0, 0, 0, 0])
        }
        await db.run("UPDATE QBStats SET completions = completions + ?, attempts = attempts + ?, touchdowns = touchdowns + ?, yards = yards + ?, interceptions = interceptions + ? WHERE discordid = ? AND guild = ?", [completions, attempts, tds, yards, ints, userid, guild])

        const newStats = await db.get("SELECT * FROM QBStats WHERE discordid = ? AND guild = ?", [userid, guild]);

        const a = Math.max(0, Math.min(((newStats.completions / newStats.attempts) - 0.3) * 5, 2.375))
        const b = Math.max(0, Math.min(((newStats.yards / newStats.attempts) - 3) * 0.25, 2.375))
        const c = Math.max(0, Math.min((newStats.touchdowns / newStats.attempts) * 20, 2.375))
        const d = Math.max(0, Math.min(2.375 - ((newStats.interceptions / newStats.attempts) * 25), 2.375))

        let passerRating = ((a + b + c + d) / 6) * 100
        passerRating = Math.round(passerRating * 10) / 10

        await db.run("UPDATE QBStats SET passer_rating = ? WHERE discordid = ? AND guild = ?", [passerRating, userid, guild])
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded QB stats!`, ephemeral:true })
    }
}
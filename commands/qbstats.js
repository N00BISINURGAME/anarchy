const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandUserOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const userOption = new SlashCommandUserOption().setRequired(true).setName('player').setDescription("The player you want to enter stats for.");
const completionsOption = new SlashCommandIntegerOption().setRequired(true).setName('completions').setDescription("The number of passes you've completed");
const attemptsOption = new SlashCommandIntegerOption().setRequired(true).setName('attempts').setDescription("The number of passes you've attempted");
const tdOption = new SlashCommandIntegerOption().setRequired(true).setName('touchdowns').setDescription("The number of touchdowns you've thrown");
const intOption = new SlashCommandIntegerOption().setRequired(true).setName('interceptions').setDescription("The number of interceptions you've thrown");
const yardsOption = new SlashCommandIntegerOption().setRequired(true).setName('yards').setDescription("The number of yards you've thrown");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qbstats')
        .addUserOption(userOption)
        .addIntegerOption(completionsOption)
        .addIntegerOption(attemptsOption)
        .addIntegerOption(tdOption)
        .addIntegerOption(intOption)
        .addIntegerOption(yardsOption)
        .setDescription('Records a players quarterback stats for use in a statsheet.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const user = interaction.options.getMember('player')
        if (!user) {
            await db.close()
            await interaction.editReply({ content:"The user you pinged may have left the server! Verify that they are in the server and try again.", ephemeral:true })
        }
        const userid = user.id;
        const guild = interaction.guild.id;
        const completions = interaction.options.getInteger('completions')
        const attempts = interaction.options.getInteger('attempts')
        const tds = interaction.options.getInteger('touchdowns')
        const ints = interaction.options.getInteger('interceptions')
        const yards = interaction.options.getInteger('yards')
        const { season } = await db.get('SELECT season FROM Leagues WHERE guild = ?', guild)

        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        const manager = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        if (!(admin || manager)) {
            await db.close()
            return interaction.editReply({ content:"You are not permitted to run this command!", ephemeral:true })
        }

        

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM QBStats WHERE discordid = ? AND guild = ? AND season = ?", [userid, guild, season]);
        if (!playerExists) {
            await db.run("INSERT INTO QBStats(discordid, guild, passer_rating, completions, attempts, touchdowns, yards, interceptions, season) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [userid, guild, 0, 0, 0, 0, 0, 0, season])
        }
        await db.run("UPDATE QBStats SET completions = completions + ?, attempts = attempts + ?, touchdowns = touchdowns + ?, yards = yards + ?, interceptions = interceptions + ? WHERE discordid = ? AND guild = ? AND season = ?", [completions, attempts, tds, yards, ints, userid, guild, season])

        const newStats = await db.get("SELECT * FROM QBStats WHERE discordid = ? AND guild = ? AND season = ?", [userid, guild, season]);

        const a = Math.max(0, Math.min(((newStats.completions / newStats.attempts) - 0.3) * 5, 2.375))
        const b = Math.max(0, Math.min(((newStats.yards / newStats.attempts) - 3) * 0.25, 2.375))
        const c = Math.max(0, Math.min((newStats.touchdowns / newStats.attempts) * 20, 2.375))
        const d = Math.max(0, Math.min(2.375 - ((newStats.interceptions / newStats.attempts) * 25), 2.375))

        let passerRating = ((a + b + c + d) / 6) * 100
        passerRating = Math.round(passerRating * 10) / 10

        console.log(passerRating)

        await db.run("UPDATE QBStats SET passer_rating = ? WHERE discordid = ? AND guild = ? AND season = ?", [passerRating, userid, guild, season])
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded QB stats!`, ephemeral:true })
    }
}
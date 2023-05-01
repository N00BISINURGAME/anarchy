const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const userOption = new SlashCommandUserOption().setRequired(true).setName('player').setDescription("The player you want to enter stats for.");
const attemptsOption = new SlashCommandIntegerOption().setRequired(true).setName('catches').setDescription("The number of catches you've made");
const tdOption = new SlashCommandIntegerOption().setRequired(true).setName('touchdowns').setDescription("The number of touchdowns you've caught");
const yardsOption = new SlashCommandIntegerOption().setRequired(true).setName('yards').setDescription("The number of yards you've ran for");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wrstats')
        .addUserOption(userOption)
        .addIntegerOption(attemptsOption)
        .addIntegerOption(tdOption)
        .addIntegerOption(yardsOption)
        .setDescription('Records a players wide receiver stats for use in a statsheet.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const user = interaction.options.getMember('player')
        if (!user) {
            await db.close()
            await interaction.editReply({ content:"The user you pinged may have left the server! Verify that they are in the server and try again.", ephemeral:true })
        }
        const userid = user.id;
        const guild = interaction.guild.id
        const attempts = interaction.options.getInteger('catches')
        const tds = interaction.options.getInteger('touchdowns')
        const yards = interaction.options.getInteger('yards')
        const { season } = await db.get('SELECT season FROM Leagues WHERE guild = ?', guild)

        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        const manager = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        if (!(admin || manager)) {
            await db.close()
            return interaction.editReply({ content:"You are not permitted to run this command!", ephemeral:true })
        }

        let average = yards / attempts
        average = Math.round(average * 10) / 10

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM WRStats WHERE discordid = ? AND guild = ? AND season = ?", [userid, guild, season]);
        if (!playerExists) {
            await db.run("INSERT INTO WRStats (discordid, guild, average, catches, touchdowns, yards, season) VALUES (?, ?, ?, ?, ?, ?, ?)", [userid, guild, 0, 0, 0, 0, season])
        }
        await db.run("UPDATE WRStats SET catches = catches + ?, touchdowns = touchdowns + ?, yards = yards + ? WHERE discordid = ? AND guild = ? AND season = ?", [attempts, tds, yards, userid, guild, season])
        await db.run("UPDATE WRStats SET average = (yards / catches) WHERE discordid = ? AND guild = ? AND season = ?", [userid, guild, season])
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded WR stats!`, ephemeral:true })
    }
}
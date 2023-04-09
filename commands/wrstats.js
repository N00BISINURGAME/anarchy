const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const attemptsOption = new SlashCommandIntegerOption().setRequired(true).setName('catches').setDescription("The number of catches you've made");
const tdOption = new SlashCommandIntegerOption().setRequired(true).setName('touchdowns').setDescription("The number of touchdowns you've caught");
const yardsOption = new SlashCommandIntegerOption().setRequired(true).setName('yards').setDescription("The number of yards you've ran for");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wrstats')
        .addIntegerOption(attemptsOption)
        .addIntegerOption(tdOption)
        .addIntegerOption(yardsOption)
        .setDescription('Records your all-time WR stats.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const attempts = interaction.options.getInteger('catches')
        const tds = interaction.options.getInteger('touchdowns')
        const yards = interaction.options.getInteger('yards')

        let average = yards / attempts
        average = Math.round(average * 10) / 10

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM WRStats WHERE discordid = ?", userid);
        if (!playerExists) {
            await db.run("INSERT INTO WRStats (discordid, average, catches, touchdowns, yards) VALUES (?, ?, ?, ?, ?)", [userid, average, attempts, tds, yards])
        } else {
            await db.run("UPDATE WRStats SET average = ?, catches = ?, touchdowns = ?, yards = ? WHERE discordid = ?", [average, attempts, tds, yards, userid])
        }
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded WR stats!`, ephemeral:true })
    }
}
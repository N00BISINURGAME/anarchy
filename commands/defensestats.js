const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const tacklesOption = new SlashCommandIntegerOption().setRequired(true).setName('tackles').setDescription("The number of tackles you've made");
const intOption = new SlashCommandIntegerOption().setRequired(true).setName('interceptions').setDescription("The number of interceptions you've caught");
const touchdownOption = new SlashCommandIntegerOption().setRequired(true).setName('defensive-touchdowns').setDescription("The number of defensive touchdowns you've gotten");
const sackOption = new SlashCommandIntegerOption().setRequired(true).setName('sacks').setDescription("The number of sacks you've gotten");
const safetyOption = new SlashCommandIntegerOption().setRequired(true).setName('safeties').setDescription("The number of safeties you've gotten");
const fumRecOption = new SlashCommandIntegerOption().setRequired(true).setName('fumble-recoveries').setDescription("The number of fumble recoveries you've made");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('defensestats')
        .addIntegerOption(tacklesOption)
        .addIntegerOption(intOption)
        .addIntegerOption(touchdownOption)
        .addIntegerOption(sackOption)
        .addIntegerOption(safetyOption)
        .addIntegerOption(fumRecOption)
        .setDescription('Records a players defensive stats for use in a statsheet.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // return interaction.editReply({ content:"this command is not finished yet!", ephemeral:true })

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id
        const tckls = interaction.options.getInteger('tackles')
        const ints = interaction.options.getInteger('interceptions')
        const tds = interaction.options.getInteger('defensive-touchdowns')
        const scks = interaction.options.getInteger('sacks')
        const sftys = interaction.options.getInteger('safeties')
        const fumrecs = interaction.options.getInteger('fumble-recoveries')

        // first, check to see if player already has qb stats logged
        const playerExists = await db.get("SELECT * FROM DefenseStats WHERE discordid = ? AND guild = ?", [userid, guild]);
        if (!playerExists) {
            await db.run("INSERT INTO DefenseStats (discordid, guild, rank, tackles, interceptions, touchdowns, sacks, safeties, fumble_recoveries) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [userid, guild, 0, 0, 0, 0, 0, 0, 0])
        }

        await db.run("UPDATE DefenseStats SET tackles = tackles + ?, interceptions = interceptions + ?, touchdowns = touchdowns + ?, sacks = sacks + ?, safeties = safeties + ?, fumble_recoveries = fumble_recoveries + ? WHERE discordid = ? AND guild = ?", [tckls, ints, tds, scks, sftys, fumrecs, userid, guild])

        const { tackles, interceptions, touchdowns, sacks, safeties, fumble_recoveries  } = await db.get('SELECT * FROM DefenseStats WHERE discordid = ? AND guild = ?', [userid, guild])

        let avg = (0.15 * tackles) + (0.2 * interceptions) + (0.2 * touchdowns) + (0.15 * sacks) + (0.2 * safeties) + (0.1 * fumble_recoveries)
        avg = Math.round(avg * 10) / 10

        await db.run("UPDATE DefenseStats SET average = ? WHERE discordid = ? AND guild = ?", [avg, userid, guild])
        
        await db.close()
        return interaction.editReply({ content:`Successfully uploaded defensive stats!`, ephemeral:true })
    }
}
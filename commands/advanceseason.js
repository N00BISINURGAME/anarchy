const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advanceseason')
        .setDescription('Advances the season by 1 and updates contracts/rosters accordingly'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id
        const authorized = await db.run('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        if (!authorized) {
            await db.close();
            return interaction.editReply("You are not authorized to advance the season!");
        }

        // then, advance the season
        await db.run("UPDATE Leagues SET season = season + 1 WHERE guild = ?", guild)

        const season = await db.get('SELECT season FROM Leagues WHERE guild = ?', guild)

        // then, change demands
        await db.run('UPDATE Players SET demands = 0 WHERE guild = ?', guild)

        // then, update standings
        await db.run('UPDATE Teams SET wins = 0, losses = 0, ties = 0 WHERE guild = ?', guild)

        // change this to dm players who have been released
        const embed = new EmbedBuilder()
            .setTitle(`Successfully advanced to season ${season.season}!`)

        await interaction.editReply({ embeds: [embed]});

        await db.close();

    }
}
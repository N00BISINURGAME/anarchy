const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandRoleOption, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers } = require('../config.json');

const idOption = new SlashCommandIntegerOption()
    .setRequired(true)
    .setName('game-id')
    .setDescription("The ID for the game you want to revert")


module.exports = {
    data: new SlashCommandBuilder()
        .setName('revertresults')
        .setDescription('Reverts game results.')
        .addIntegerOption(idOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id
        const gameId = interaction.options.getInteger('game-id')

        const adminAuth = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        const managerAuth = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user, guild])
        if (!adminAuth && !managerAuth) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to revert game results!", ephemeral: true });
        }

        const oldResults = await db.get('SELECT * FROM Results WHERE id = ?', gameId)
        if (!oldResults) {
          await db.close();
          return interaction.editReply({ content:"The specified game ID is invalid!", ephemeral: true });
        }

        const ptDifferential = oldResults.winnerscore - oldResults.loserscore
        await db.run('UPDATE Teams SET wins = wins - 1, ptdifferential = ptdifferential - ? WHERE name = ? AND guild = ?', [ptDifferential, oldResults.winner, guild])
        await db.run('UPDATE Teams SET losses = losses - 1, ptdifferential = ptdifferential + ? WHERE name = ? AND guild = ?', [ptDifferential, oldResults.loser, guild])
        await db.run('DELETE FROM Results WHERE id = ?', oldResults.id)

        await db.close();
        return interaction.editReply({ content:`The game with ID ${oldResults.id} has been reverted!`, ephemeral: true });
    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

const capOption = new SlashCommandIntegerOption()
                                .setRequired(true)
                                .setName('max-demands')
                                .setDescription('The maximum demands each player is allowed to have per season.')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setdemands')
        .addIntegerOption(capOption)
        .setDescription('Sets the maximum player count per team to a specified value.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id
        const maxPlayers = interaction.options.getInteger("max-demands")
        const authorized = await db.run('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        if (!authorized) {
            await db.close();
            return interaction.editReply("You are not authorized to change demands!");
        }

        // then, advance the season
        await db.run("UPDATE Leagues SET demands = ? WHERE guild = ?", [maxPlayers, guild])

        await db.close();

        return interaction.editReply({ content:`Demands successfully set at ${maxPlayers}!`, ephemeral:true});

        

    }
}
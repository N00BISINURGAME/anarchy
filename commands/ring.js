const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to get all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ring')
        .setDescription('Adds a ring to a team and its players')
        .addMentionableOption(teamOption),
    async execute(interaction) {
            const db = await getDBConnection();
            const guild = interaction.guild.id

            // first, check to see if the user is authorized to advance the season
            const user = interaction.user.id;
            const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
            if (!authorized) {
                await db.close();
                return interaction.editReply({ content:"You are not authorized to award rings!", ephemeral:true });
            }

            const team = interaction.options.getMentionable('team')

            // check to see if the team exists
            const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [team.id, guild])
            if (!teamExists) {
                await db.close();
                return interaction.editReply({content:"This team does not exist! Ensure you're pinging a team that exists.", ephemeral:true});
            }

            // then, get all players from the specified team
            for (const member of team.members.keys()) {
                await db.run('UPDATE Players SET rings = rings + 1 WHERE discordid = ? AND guild = ?', [member, guild]);
            }
            await db.run("UPDATE Teams SET rings = rings + 1 WHERE code = ? AND guild = ?", [teamExists.code, guild]);

            await interaction.editReply(`The ${team} have been awarded with a ring!`);

            await db.close();

    }
}
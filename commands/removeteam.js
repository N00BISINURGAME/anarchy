const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');
const {maxPlayers} = require('../config.json')

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to release all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeteam')
        .setDescription('Removes a team from the league.')
        .addMentionableOption(teamOption),
    async execute(interaction) {
            const db = await getDBConnection();
            const guild = interaction.guild.id

            // first, check to see if the user is authorized to advance the season
            const user = interaction.user.id;
            const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
            if (!authorized) {
                await db.close();
                return interaction.editReply({ content:"You are not authorized to mass release!", ephemeral:true });
            }

            const channelExists = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
            if (!channelExists) {
                await db.close();
                return interaction.editReply({ content:"A notices channel has not been set yet!", ephemeral:true });
            }

            const team = interaction.options.getMentionable('team')

            // check to see if the team exists
            const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [team.id, guild])
            if (!teamExists) {
                await db.close();
                return interaction.editReply({ content:"This team does not exist! Ensure you're pinging a team that exists.", ephemeral:true });
            }

            await db.run('DELETE FROM Teams WHERE code = ? AND guild = ?', [teamExists.code, guild])
            await db.run('DELETE FROM Roles WHERE code = ? AND guild = ?', [teamExists.code, guild])

            await team.delete()
            

            await interaction.editReply({ content:"Team has been removed!", ephemeral:true })

            await db.close();

    }
}
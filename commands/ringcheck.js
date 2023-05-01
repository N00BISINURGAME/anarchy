const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandUserOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

const mentionableOption = new SlashCommandUserOption().setRequired(true).setName('user').setDescription('The user whose rings you want to see');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ringcheck')
        .setDescription('Shows the number of rings a player has.')
        .addMentionableOption(mentionableOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get the role or person mentioned
        const user = interaction.options.getMentionable("user");
        if (!user) {
            await db.close()
            return interaction.editReply({ content:`This user may have left the server! Ensure they are in the server and try again.`, ephemeral:true});
        }

        // then, get the id of the mentioned
        const id = mentioned.id;
        const guild = interaction.guild.id

        // two branches: one for pinged role, one for pinged person
        const rings = await db.get('SELECT rings FROM Players WHERE discordid = ? AND guild = ?', [id, guild])

        await db.close();
        return interaction.editReply({ content:`${user} has ${rings.rings} rings!`, ephemeral:true});

    }
}
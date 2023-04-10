const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const roleOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName('role')
    .setDescription('The role to assign the user')
    .addChoices(
        {name:"General Manager", value:"GM"},
        {name:"Head Coach", value:"HC"}
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getstats')
        .setDescription('Gets the stats of the top 10 people in a particular category.')
        .addStringOption(roleOption),
    async execute(interaction) {
        // needs to be implemented
        const db = await getDBConnection();

        await db.close();
    }
}
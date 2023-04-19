const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const fullOption = new SlashCommandStringOption().setRequired(true).setName('team-full-name').setDescription('The full name of the team you want to create');

const shortOption = new SlashCommandStringOption().setRequired(true).setName('team-short-name').setDescription('The abbreviation of the team you want to create');

const logoOption = new SlashCommandStringOption().setRequired(true).setName('team-logo').setDescription('A link to the logo for the team.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('newteam')
        .setDescription('Creates a new team.')
        .addStringOption(fullOption)
        .addStringOption(shortOption)
        .addStringOption(logoOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to create a team
        const user = interaction.user.id;
        const guild = interaction.guild.id
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        if (!authorized) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to create a new team!", ephemeral:true });
        }

        const fullName = interaction.options.getString('team-full-name')
        const shortName = interaction.options.getString('team-short-name')
        const logo = interaction.options.getString('team-logo')

        const regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/

        const matches = logo.match(regex)

        if (!matches) {
            return interaction.editReply({ content:"The logo you provided may not be valid! Ensure it is a valid image link. Feel free to DM Donovan#3771 with any questions.", ephemeral:true })
        }

        // Checks to see if a team exists
        const teamExists = await db.get('SELECT code FROM Teams WHERE (code = ? OR name = ?) AND guild = ?', [shortName.toUpperCase(), fullName, guild]);
        if (teamExists) {
            await db.close();
            return interaction.editReply({ content:"This team already exists! Please ensure that the team is unique. Unique teams must have a unique full name and a unique short name.", ephemeral:true });
        }

        // then, insert the team
        await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [shortName.toUpperCase(), fullName, logo, guild]);

        // Then, create the role for the team in the guild that the command was called in.
        const newRole = await interaction.guild.roles.create({
            name: fullName
        });

        await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [shortName.toUpperCase(), newRole.id, guild]);
        await interaction.editReply({ content:'Team has successfully been created!', ephemeral:true });

        await db.close();
    }
}
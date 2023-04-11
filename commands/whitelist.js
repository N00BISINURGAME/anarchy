const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption, EmbedBuilder, SlashCommandSubcommandBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

const nameOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('user')
    .setDescription('The person to whitelist')

const fieldOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("role")
    .setDescription("The role you want to whitelist the user for")
    .addChoices(
        {name:"Manager", value:"managers"},
        {name:"Admin", value:"admins"}
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Whitelists a user for a specific role.')
        .addUserOption(nameOption)
        .addStringOption(fieldOption),
    async execute(interaction) {
        const db = await getDBConnection()
        const user = interaction.options.getUser("user");
        const type = interaction.options.getString("role");
        const guild = interaction.guild.id

        console.log(interaction.guild.owner)
        console.log(interaction.user.id)

        if (interaction.guild.ownerId !== interaction.user.id) {
            return interaction.editReply({ content:`You are not authorized to whitelist individuals!`, ephemeral:true });
        }

        if (type === "managers") {
            const managerExists = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user.id, guild])
            if (managerExists) {
                return interaction.editReply({ content:`${user} has already been whitelisted!`, ephemeral:true });
            }
            await db.run('INSERT INTO Managers(discordid, guild) VALUES (?, ?)', [user.id, guild])
        } else if (type === "admins") {
            const managerExists = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user.id, guild])
            if (managerExists) {
                return interaction.editReply({ content:`${user} has already been whitelisted!`, ephemeral:true });
            }
            await db.run('INSERT INTO Admins(discordid, guild) VALUES (?, ?)', [user.id, guild])
        }
        return interaction.editReply({ content:`Successfully whitelisted ${user}!`, ephemeral:true });
    }
}
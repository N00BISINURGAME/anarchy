const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandRoleOption, SlashCommandStringOption, EmbedBuilder, ChannelType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const roleOption = new SlashCommandRoleOption().setName("role").setDescription("The role you want to link with the bot").setRequired(true)

const roleChoices = new SlashCommandStringOption().setName("role-options").setDescription("The possible types of roles").setRequired(true)
                          .addChoices(
                            { name:"Free Agent", value: "FA" },
                            { name:"Eligible Player", value:"ELIG" },
                            { name:"Franchise Owner", value:"FO" },
                            { name:"General Manager", value:"GM" },
                            { name:"Head Coach", value:"HC" }
                          )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrole')
        .addRoleOption(roleOption)
        .addStringOption(roleChoices)
        .setDescription('Allows you to set a channel for a specific purpose'),
    async execute(interaction) {
        const db = await getDBConnection();
        const role = interaction.options.getRole("role")
        const choice = interaction.options.getString("role-options")
        const guild = interaction.guild.id

        const user = interaction.user.id;
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        if (!authorized) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to set roles!", ephemeral:true });
        }

        // check if the channel exists
        const roleExists = await db.get('SELECT * FROM Roles WHERE code = ? AND guild = ?', [choice, guild])
        if (roleExists) {
            await db.run('UPDATE Roles SET roleid = ? WHERE code = ? AND guild = ?', [role.id, choice, guild])
        } else {
            await db.run('INSERT INTO Roles(roleid, code, guild) VALUES (?, ?, ?)', [role.id, choice, guild])
        }
        await db.close()
        return interaction.editReply({content:`Successfully linked ${role} for your chosen option!`})
    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandRoleOption} = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const userOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('player')
    .setDescription('The player who you want to promote to franchise owner');

const teamOption = new SlashCommandRoleOption()
    .setRequired(true)
    .setName('team')
    .setDescription('The team you want to make the specified user franchise owner of')



module.exports = {
    data: new SlashCommandBuilder()
        .setName('fo')
        .setDescription('Assign a franchise owner to a team.')
        .addUserOption(userOption)
        .addRoleOption(teamOption),
    async execute(interaction) {
        const db = await getDBConnection();

        const userId = interaction.user.id;
        const userChoice = interaction.options.getMember('player');
        const teamChoice = interaction.options.getRole('team')
        const chosenUserId = userChoice.id;
        const guild = interaction.guild.id

        // check if the user is trying to assign themselves a role

        // first, check which branch of code we go into
        // if the choice is to assign a franchise owner, check if they are authorized.
        // this means the person calling the command must be on the admin list.
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [userId, guild])
        if (!authorized) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to assign a franchise owner!", ephemeral:true });
        }

        // then, check to see if the team exists or not
        const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ? AND NOT code = "FA" AND NOT code = "GM" AND NOT code = "HC" AND NOT code = "FO"', [teamChoice.id, guild])

        if (!teamExists) {
            await db.close()
            return interaction.editReply({ content:'The specified team is not a valid team! Ensure the team exists before assigning a player to be an FO.', ephemeral:true })
        }

        // check if fo role exists
        const foRole = await db.get('SELECT roleid FROM Roles WHERE code = "FO" AND guild = ?', guild);
        if (!foRole) {
            await db.close()
            return interaction.editReply({ content:'The franchise owner role does not exist in the database! You may need to run /setup.', ephemeral:true })
        }

        // then, check if team pinged has a fo
        const teamMembers = teamChoice.members
        for (const member of teamMembers.values()) {
            if (member.roles.cache.get(foRole.roleid)) {
                await db.close();
                return interaction.editReply({ content:'This role has already been filled!', ephemeral:true });
            }
        }

        // then, add the team role to the player
        userChoice.roles.add(foRole.roleid)
        userChoice.roles.add(teamChoice.id)

        // then, send a message back to the user
        await interaction.editReply({ content:'Successfully promoted the specified user to franchise owner!', ephemeral:true });
        await db.close();
    }
}
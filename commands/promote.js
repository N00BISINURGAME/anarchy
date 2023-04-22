const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const userOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('player')
    .setDescription('The player whose role you want to change');

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
        .setName('promote')
        .setDescription('Promote a specific player to a role on the team.')
        .addUserOption(userOption)
        .addStringOption(roleOption),
    async execute(interaction) {
        const db = await getDBConnection();

        const userId = interaction.user.id;
        const roleChoice = interaction.options.getString('role');
        const userChoice = interaction.options.getMember('player');
        const guild = interaction.guild.id

        // check if a transaction channel has been set
        const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        if (!transactionExists) {
            await db.close()
            return interaction.editReply({ content: "A transaction channel has not been set!", ephemeral: true})
        }

        // check if the user is trying to assign themselves a role
        if (userId === userChoice.id) return interaction.editReply({ content:'You cannot assign yourself a role!', ephemeral:true });

        // if the choice is to assign a general manager or head coach, check if they are authorized.
        // this means the person must be a franchise owner.
        const foRole = await db.get('SELECT * FROM Roles WHERE code = "FO" AND guild = ?', [guild])
        if (!foRole) {
            await db.close()
            return interaction.editReply({ content: "A franchise owner role has not been detected! You may need to run /setup", ephemeral: true})
        }

        
        if (!(interaction.member.roles.cache.get(foRole.roleid))) {
            await db.close();
            return interaction.editReply({ content:`You are not authorized to assign a ${roleChoice}! To do so you must be a franchise owner.`, ephemeral:true });
        }

        // then, check to see if the user pinged is on the same team as the user who ran the command
        const chosenUserId = userChoice.id;
        let teamRole;
        for (const role of interaction.member.roles.cache.values()) {
            const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role.id, guild])
            // we have a valid role in the database!
            if (roleExists) {
                if (!(roleExists.code === "FO" || roleExists.code === "GM" || roleExists.code === "HC")) {
                    // and it's a valid team role! we can now compare against the cache of the
                    // person that was pinged
                    if (!(userChoice.roles.cache.get(role.id))) {
                        await db.close()
                        return interaction.editReply({ content:"This person is not on your team!", ephemeral:true })
                    }
                    teamRole = role
                    break;
                }
            }
        }

        // then, check to see if the role is taken or not
        const promoteRoleCode = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [roleChoice, guild])
        if (!promoteRoleCode) {
            await db.close();
            return interaction.editReply({ content:`The ${roleChoice} role has not been detected! You may need to run /setup`, ephemeral:true });
        }
        for (const member of teamRole.members.values()) {
            if (member.roles.cache.get(promoteRoleCode.roleid)) {
                await db.close();
                return interaction.editReply({ content:'This role has already been filled!', ephemeral:true });
            }
        }

        // then, check to see if they already have a role on the team
        const frontOfficeRoles = await db.all('SELECT roleid FROM Roles WHERE (code = "FO" OR code = "GM" OR code = "HC") AND guild = ?', guild)
        for (const role of frontOfficeRoles) {
            if (userChoice.roles.cache.get(role.roleid)) {
                await db.close();
                return interaction.editReply({ content:'This user already has a front office role!', ephemeral:true });
            }
        }

        // then, give the role to the player
        await userChoice.roles.add(promoteRoleCode.roleid)

        // then, get the team logo
        const logo = await db.get('SELECT t.logo FROM Teams t, Roles r WHERE t.code = r.code AND r.roleid = ? AND r.guild = ?', [teamRole.id, guild]);
        const logoStr = logo.logo;

        const roleObj = await interaction.guild.roles.fetch(promoteRoleCode.roleid)

        // then, create the embed
        const transactionEmbed = new EmbedBuilder()
            .setTitle('Player promoted!')
            .setThumbnail(logoStr)
            .setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
            .setColor(teamRole.color)
            .setDescription(`The ${teamRole} have promoted ${userChoice} (${userChoice.user.tag}) to ${roleObj}!
            \n>>> **Franchise Owner:** ${interaction.member} (${interaction.user.tag})`)

        // then, get the transaction channel ID and send a transaction message
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        await transactionChannel.send({ embeds: [transactionEmbed] })

        await interaction.editReply({ content:"Successfully promoted user!", ephemeral:true })
        // two branches: one for assigning FO and one for assigning GM/HC
        await db.close();
    }
}
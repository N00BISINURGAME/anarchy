const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const userOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('player')
    .setDescription('The player whose role you want to change');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription('Demote a specific player from a role on the team.')
        .addUserOption(userOption),
    async execute(interaction) {
        const db = await getDBConnection();

        const userId = interaction.user.id;
        const userChoice = interaction.options.getMember('player');
        const guild = interaction.guild.id
        const demoterRoles = interaction.member.roles.cache

        const channelExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        if (!channelExists) {
            await db.close()
            return interaction.editReply({ content:'The transactions channel does not exist! This can be set by using /setup or /channel.', ephemeral:true });
        }

        // check if the user is trying to assign themselves a role

        if (userId === userChoice.id){
            await db.close()
            return interaction.editReply({ content:'You are unable to demote yourself!', ephemeral:true });
        }

        // first, check to see if the pinged player is an FO
        let specialRole;
        let isFO = false;
        const roles = userChoice.roles.cache
        // go thru all roles and see if the person pinged has a special role
        for (const role of roles.keys()) {
            const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
            if (roleExists) {
                if (roleExists.code === "FO") {
                    isFO = true;
                    specialRole = role;
                    break;
                } else if (roleExists.code === "GM" || roleExists.code === "HC") {
                    specialRole = role;
                    break;
                }
            }
        }

        if (isFO) {
            const noticeExists = await db.get('SELECT * FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
            if (!noticeExists) {
                await db.close()
                return interaction.editReply({ content:'The notices channel does not exist! This can be set by using /channel.', ephemeral:true });
            }
            // then, check if the user running the command is an admin
            const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [userId, guild])
            if (!authorized) {
                await db.close()
                return interaction.editReply({ content:"You are not authorized to demote franchise owners!", ephemeral:true })
            }
            await userChoice.roles.remove(specialRole);

            let teamRole;
            for (const role of demoterRoles.values()) {
                const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role.id, guild])
                // we have a valid role in the database!
                if (roleExists) {
                    if (!(roleExists.code === "FO" || roleExists.code === "GM" || roleExists.code === "HC")) {
                        // and it's a valid team role! we can now compare against the cache of the
                        // person that was pinged
                        teamRole = role
                        break;
                    }
                }
            }

            const logo = await db.get('SELECT logo FROM Teams t, Roles r WHERE t.code = r.code AND t.guild = r.guild AND r.roleid = ? AND r.guild = ?', [teamRole.id, guild]);
            const logoStr = logo.logo;

            const foRole = await interaction.guild.roles.fetch(specialRole)

            const transactionEmbed = new EmbedBuilder()
                .setTitle('Franchise Owner demoted!')
                .setThumbnail(logoStr)
                .setDescription(`${userChoice} \`${userChoice.user.tag}\` has been demoted from ${foRole} of the ${teamRole}!
                \n>>> **Admin:** ${interaction.member} \`${interaction.user.tag}\``)
                .setColor(teamRole.color)
            if (interaction.user.avatarURL()) {
                transactionEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
            } else {
                transactionEmbed.setFooter({ text: `${interaction.user.tag}` })
            }
            const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
            const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

            await transactionChannel.send({ embeds: [transactionEmbed] })
            await db.close()
            return interaction.editReply({ content:"Successfully demoted franchise owner down!", ephemeral:true })
        }

        // then, check to see if the user pinged is on the same team as the user who ran the command
        // need to do this part -- get team role for franchise owner and get team role for player pinged
        let teamRole;
        for (const role of demoterRoles.values()) {
            const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role.id, guild])
            // we have a valid role in the database!
            if (roleExists) {
                if (!(roleExists.code === "FO" || roleExists.code === "GM" || roleExists.code === "HC")) {
                    // and it's a valid team role! we can now compare against the cache of the
                    // person that was pinged
                    if (!(roles.get(role.id))) {
                        await db.close()
                        return interaction.editReply({ content:"This person is not on your team!", ephemeral:true })
                    }
                    teamRole = role
                    break;
                }
            }
        }

        
        const foRoleid = await db.get('SELECT roleid FROM Roles WHERE code = "FO" AND guild = ?', guild)
        if (!foRoleid) {
            await db.close()
            return interaction.editReply({ content:"The franchise owner role does not exist in the database! This may be a sign that you need to run /setup.", ephemeral:true })
        }
        if (!(demoterRoles.get(foRoleid.roleid))) {
            await db.close()
            return interaction.editReply({ content:"You are not authorized to demote individuals, as you are not a franchise owner!", ephemeral:true })
        }

        // check and see if theyre actually a member of the front office
        if (!specialRole) {
            await db.close()
            return interaction.editReply({ content:"This person is not a member of your front office!", ephemeral:true })
        }

        // then, take away the role from the person
        await userChoice.roles.remove(specialRole);

        // then, get the team logo
        const logo = await db.get('SELECT logo FROM Teams t, Roles r WHERE t.code = r.code AND t.guild = r.guild AND r.roleid = ? AND r.guild = ?', [teamRole.id, guild]);
        const logoStr = logo.logo;

        const specialRoleObj = await interaction.guild.roles.fetch(specialRole)

        const transactionEmbed = new EmbedBuilder()
            .setTitle('Player demoted!')
            .setThumbnail(logoStr)
            .setDescription(`The ${teamRole}'s Franchise Owner has demoted ${userChoice} \`${userChoice.user.tag}\` from ${specialRoleObj}!
            \n>>> **Franchise Owner:** ${interaction.member} \`${interaction.user.tag}\``)
            .setColor(teamRole.color)
        if (interaction.user.avatarURL()) {
            transactionEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            transactionEmbed.setFooter({ text: `${interaction.user.tag}` })
        }

        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        await transactionChannel.send({ embeds: [transactionEmbed] })
        await interaction.editReply("Successfully demoted user!");
        // two branches: one for assigning FO and one for assigning GM/HC
        await db.close();
    }
}
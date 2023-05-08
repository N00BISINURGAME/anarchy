const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to get all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demand')
        .setDescription('Allows a player to demand from their team.'),
    async execute(interaction) {
        const db = await getDBConnection();
        const userid = interaction.user.id;
        const guild = interaction.guild.id

        const maxPlayerQry = await db.get('SELECT maxplayers, demands FROM Leagues WHERE guild = ?', guild)

        // first, get special roles and get team role
        let teamRole;
        let specialRole;
        let isFo = false
        for (const role of interaction.member.roles.cache.values()) {
            if (teamRole && specialRole) {
                break;
            }
            const roleInDb = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role.id, guild])
            if (roleInDb) {
                if (!specialRole && (roleInDb.code === "FO" || roleInDb.code === "GM" ||roleInDb.code === "HC")) {
                    specialRole = role;
                    if (roleInDb.code === "FO") {
                        isFo = true
                    }
                } else if (!teamRole) {
                    teamRole = role;
                }
            }
        }

        if (!teamRole) {
            await db.close()
            return interaction.editReply({ content:"You are not currently on a team!", ephemeral:true})
        }

        if (isFo) {
            await db.close()
            return interaction.editReply({ content:"You are not permitted to demand from your team!", ephemeral:true})
        }

        // then, check if they still have demands
        const currentPlayer = await db.get('SELECT demands FROM Players WHERE discordid = ? AND guild = ?', [userid, guild])
        if (currentPlayer.demands >= maxPlayerQry.demands) {
            await db.close()
            return interaction.editReply({ content:"You are no longer allowed to demand!", ephemeral:true})
        }

        // then, decrement their demands counter by 1 and remove them from their team
        await db.run('UPDATE Players SET demands = demands + 1 WHERE discordid = ? AND guild = ?', [userid, guild]);

        const demandStr = `This player has ${(maxPlayerQry.demands - currentPlayer.demands) - 1} demands left`

        // then, take away their roles
        if (specialRole) {
            await interaction.member.roles.remove(specialRole)
        }
        if (teamRole) {
            await interaction.member.roles.remove(teamRole)
        }

        const team = await db.get('SELECT t.logo FROM Teams t, Roles r WHERE t.code = r.code AND t.guild = r.guild AND r.roleid = ? AND r.guild = ?', [teamRole.id, guild])

        // then, construct the embed
        const demandEmbed = new EmbedBuilder()
                    .setTitle("Player demanded!")
                    .setThumbnail(team.logo)
                    .setColor(teamRole.color)
                    .setDescription(`${interaction.member} \`${interaction.user.tag}\` has demanded from the ${teamRole}! ${specialRole ? `This person was the ${specialRole}.` : ""}
                    \n>>> **Roster:** \`${teamRole.members.size}/${maxPlayerQry.maxplayers}\``)
        if (interaction.user.avatarURL()) {
            demandEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            demandEmbed.setFooter({ text: `${interaction.user.tag}` })
        }
        // then, send the message to demands channel
        const demandChannelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "demands" AND guild = ?', guild);
        if (demandChannelId) {
            const demandChannel = await interaction.guild.channels.fetch(demandChannelId.channelid);
            await demandChannel.send({ embeds:[demandEmbed] })
        }

        demandEmbed.setDescription(
            `${interaction.user.tag} has demanded from the ${teamRole.name}! ${specialRole ? `This person was the ${specialRole.name}.` : ""}
                    \n>>> **Roster:** \`${teamRole.members.size}/${maxPlayerQry.maxplayers}\`\n**Guild:** ${interaction.guild.name}`
        )

        // const foRole = await db.get('SELECT roleid FROM Roles WHERE guild = ?', guild)
        // if (foRole) {
        //     // then, dm the franchise owner notifying them
        //     for (const roleMember of teamRole.members.values()) {
        //         const roleMemberRoles = roleMember.roles.cache
        //         if (roleMemberRoles.get(foRole.roleid)) {
        //             demandEmbed.setDescription(`${interaction.member} \`${interaction.user.tag}\` has demanded from the ${teamRole.name} in ${interaction.guild.name}! ${specialRole ? `This person was the ${specialRole.name}.` : ""}
        //             \n>>> **Roster:** \`${teamRole.members.size}/${maxPlayerQry.maxplayers}\``)
        //             await roleMember.send( {embeds:[demandEmbed]})
        //             break
        //         }
        //     }
        // }
        
        await db.close()
        await interaction.editReply( {content:`Successfully demanded! You have ${(maxPlayerQry.demands - currentPlayer.demands) - 1} demands left!`, ephemeral:true})
    }
}
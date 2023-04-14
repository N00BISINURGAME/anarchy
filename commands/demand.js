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

        // first, check if the user is on a team (and also get the role id)
        const onTeam = await db.get('SELECT p.*, r.roleid, t.logo, t.playercount FROM Players p, Roles r, Teams t WHERE r.code = p.team AND p.team = t.code AND p.discordid = ? AND p.guild = ?', [userid, guild]);
        console.log(onTeam)
        if (!onTeam) {
            await db.close()
            return interaction.editReply({ content:"You are currently a free agent!", ephemeral:true})
        }

        if (onTeam.role === "FO") {
            await db.close()
            return interaction.editReply({ content:"You are not permitted to demand from your team!", ephemeral:true})
        }

        // then, check if they still have demands
        if (onTeam.demands === 0) {
            await db.close()
            return interaction.editReply({ content:"You are no longer allowed to demand!", ephemeral:true})
        }

        // then, decrement their demands counter by 1 and remove them from their team
        await db.run('UPDATE Players SET demands = demands - 1, team = "FA", role = "P", contractlength = -1  WHERE discordid = ? AND guild = ?', [userid, guild]);

        const demandStr = onTeam.demands - 1 === 1 ? "This player has 1 more demand!" : "This player has no more demands!"

        // then, decrement the count of the team they were previously on
        await db.run('UPDATE Teams SET playercount = playercount - 1 WHERE code = ? AND guild = ?', [onTeam.team, guild]);

        const role = await interaction.guild.roles.fetch(onTeam.roleid)

        // then, construct the embed
        const demandEmbed = new EmbedBuilder()
                    .setTitle("Player demanded!")
                    .setThumbnail(onTeam.logo)
                    .addFields(
                        {name:"Player", value:`${interaction.user}\n${interaction.user.tag}`},
                        {name:"Team", value:`${role}`},
                    )
                    .setFooter({ text:`Roster size: ${onTeam.playercount - 1} / ${maxPlayers} • ${demandStr}`})

        // then, send the message to demands channel
        const demandChannelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "demands" AND guild = ?', guild);
        const demandChannel = await interaction.guild.channels.fetch(demandChannelId.channelid);
        await demandChannel.send({ embeds:[demandEmbed] })

        // then, remove the player's roles
        const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [onTeam.team, guild])
        await interaction.member.roles.remove(roleId.roleid)
        if (onTeam.role === "HC" || onTeam.role === "GM") {
            const specialRoleId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [onTeam.role, guild])
            await interaction.member.roles.remove(specialRoleId.roleid)
        }

        // then, dm the franchise owner notifying them
        const foID = await db.get("SELECT discordid FROM Players WHERE team = ? AND role = 'FO' AND guild = ?", [onTeam.team, guild])
        const userObj = await interaction.guild.members.fetch(foID.discordid)
        const dmChannel = await userObj.createDM()
        await dmChannel.send( {embeds:[demandEmbed] })
        return interaction.editReply({ content:`Successfully demanded from the ${role}! You have ${onTeam.demands - 1} ${onTeam.demands - 1 === 1 ? "demand" : "demands"} left!`, ephemeral:true })
    }
}
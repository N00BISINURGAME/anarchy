const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');
const {maxPlayers} = require('../config.json')

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to release all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disband')
        .setDescription('Releases all players from a team.')
        .addMentionableOption(teamOption),
    async execute(interaction) {
            const db = await getDBConnection();
            const guild = interaction.guild.id

            // first, check to see if the user is authorized to advance the season
            const user = interaction.user.id;
            const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
            if (!authorized) {
                await db.close();
                return interaction.editReply({ content:"You are not authorized to mass release!", ephemeral:true });
            }

            // then, get the transaction channel ID and send a transaction message
            const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
            if (!channelId) {
                await db.close();
                return interaction.editReply({ content:"A notices channel has not been set! This can be set by running /channel.", ephemeral:true });
            }

            const team = interaction.options.getMentionable('team')

            // check to see if the team exists
            const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [team.id, guild])
            if (!teamExists) {
                await db.close();
                return interaction.editReply({ content:"This team does not exist! Ensure you're pinging a team that exists.", ephemeral:true });
            }

            const frontOfficeRoles = await db.all('SELECT * FROM Roles WHERE (code = "FO" OR code = "GM" OR code = "HC") AND guild = ?', guild)

            // then, remove roles from players
            let userStr = ""
            // this needs to be updated to remove gm/hc roles too
            for (const member of team.members.values()) {
                userStr += `${member} \`${member.user.tag}\`\n`
                await member.roles.remove(team)
                for (const role of frontOfficeRoles) {
                    if (member.roles.cache.get(role.roleid)) {
                        await member.roles.remove(role.roleid)
                    }
                }
            }

            if (userStr === "") userStr = "None\n"

            // then, get the team logo and player count
            const logo = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [teamExists.code, guild]);
            const logoStr = logo.logo;

            if (channelId) {
                const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

                const maxPlayerCount = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guild)

                // then, format the embed and send it to the transaction channel
                const transactionEmbed = new EmbedBuilder()
                    .setTitle("Team disbanded!")
                    .setThumbnail(logoStr)
                    .setColor(team.color)
                    .setDescription(`All members of the ${team} have been released!
                    \n**Affected users:**\n${userStr}\n>>> **Staff:** ${interaction.member} \`${interaction.user.tag}\``)
                if (interaction.user.avatarURL()) {
                    transactionEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
                } else {
                    transactionEmbed.setFooter({ text: `${interaction.user.tag}` })
                }

                await transactionChannel.send({ embeds: [transactionEmbed] });
            }

            await interaction.editReply({ content:"All players released from team!", ephemeral:true })

            await db.close();

    }
}
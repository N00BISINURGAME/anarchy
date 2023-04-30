const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');
const {maxPlayers} = require('../config.json')

const teamOption = new SlashCommandIntegerOption().setRequired(true).setName('threshold').setDescription('The minimum number of players a team must have.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disband')
        .setDescription('Releases all players from a team.')
        .addIntegerOption(teamOption),
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

            const min = interaction.options.getInteger('threshold')

            const allTeams = await db.all('SELECT roleid FROM Roles WHERE NOT (code = "FO" OR code = "GM" OR code = "HC") AND guild = ?', guild)
            let disbandedStr = ""

            for (const team of allTeams) {
              const teamObj = await interaction.guild.roles.fetch(team.roleid)
              if (teamObj.members.size < min) {
                for (const member of teamObj.members.values()) {
                  await member.roles.remove(team.roleid)
                  disbandedStr += `${teamObj}\n`
                }
              }
              
            }

            if (disbandedStr === "") disbandedStr = "None\n"

            if (channelId) {
                const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

                const maxPlayerCount = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guild)

                // then, format the embed and send it to the transaction channel
                const transactionEmbed = new EmbedBuilder()
                    .setTitle("Multiple teams disbanded!")
                    .setColor([0, 0, 0])
                    .setDescription(`Multiple teams have been disbanded due to having less than **${min}** players!
                    \n**Affected teams:**\n${disbandedStr}\n>>> **Staff:** ${interaction.member} (${interaction.user.tag})`)

                if (interaction.guild.iconURL()) {
                  transactionEmbed.setThumbnail(interaction.guild.iconURL())
                }
                if (interaction.user.avatarURL()) {
                    transactionEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
                } else {
                    transactionEmbed.setFooter({ text: `${interaction.user.tag}` })
                }

                await transactionChannel.send({ embeds: [transactionEmbed] });
            }

            await interaction.editReply({ content:"All relevant teams disbanded!", ephemeral:true })

            await db.close();

    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');
const {maxPlayers} = require('../config.json')

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to release all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('releaseall')
        .setDescription('Releases all players from a team.')
        .addMentionableOption(teamOption),
    async execute(interaction) {
            const db = await getDBConnection();

            // first, check to see if the user is authorized to advance the season
            const user = interaction.user.id;
            if (!admins.includes(user)) {
                await db.close();
                return interaction.editReply({ content:"You are not authorized to mass release!", ephemeral:true });
            }

            const team = interaction.options.getMentionable('team')

            // check to see if the team exists
            const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ?', team.id)
            if (!teamExists) {
                await db.close();
                return interaction.editReply({ content:"This team does not exist! Ensure you're pinging a team that exists.", ephemeral:true });
            }

            // then, remove roles from players
            const users = await db.all("SELECT p.discordid, r.roleid FROM Players p, Roles r WHERE r.roleid = ? AND p.team = r.code AND NOT p.role = 'FO'", team.id);
            const guildMembers = interaction.guild.members;
            let userStr = ""
            // this needs to be updated to remove gm/hc roles too
            for (let i = 0; i < users.length; i++) {
                let user = await interaction.client.users.cache.get(users[i].discordid);
                try {
                    let userObj = await guildMembers.fetch(user)
                    userStr += `${user}\n${user.tag}\n`
                    await userObj.roles.remove(users[i].roleid);
                } catch(err) {
                    continue
                }
            }

            if (userStr === "") userStr = "None"

            // then, remove all players from the team
            await db.run('UPDATE Players SET team = "FA", role = "P" WHERE team = ? AND NOT role = "FO"', teamExists.code);

            // then, set player count to 1
            await db.run('UPDATE Teams SET playercount = (SELECT COUNT(*) FROM Players WHERE team = ?) WHERE code = ?', [teamExists.code,teamExists.code])

            // then, get the team logo and player count
            const logo = await db.get('SELECT logo, playercount FROM Teams WHERE code = ?', teamExists.code);
            const playerCount = logo.playercount
            const logoStr = logo.logo;

            // then, get the transaction channel ID and send a transaction message
            const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions"')
            const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

            // then, format the embed and send it to the transaction channel
            const transactionEmbed = new EmbedBuilder()
                .setTitle("Team mass release!")
                .setThumbnail(logoStr)
                .setDescription(`**Team**\n${team}\n\n**Players**\n${userStr}`)
                .setFooter({ text:`Roster size: ${playerCount} / ${maxPlayers} • This team was released by ${interaction.user.tag}`})

            await transactionChannel.send({ embeds: [transactionEmbed] });

            await interaction.editReply({ content:"All players released from team!", ephemeral:true })

            await db.close();

    }
}
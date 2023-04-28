const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder, Embed } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const {maxPlayers} = require('../config.json')

const userOption = new SlashCommandUserOption();
userOption.setRequired(true);
userOption.setName('player');
userOption.setDescription('The player to sign');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('release')
        .setDescription('Release a player from a team.')
        .addUserOption(userOption),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id
        // gets all information that the user sent
        const user = interaction.options.getMember('player');
        const userid = user.id;

        // check if a transaction channel has been set
        const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        if (!transactionExists) {
            await db.close()
            return interaction.editReply({ content: "A transaction channel has not been set! This can be set by running /setup or /channel.", ephemeral: true})
        }

        // first, check and see if the user that sent the command is authorized to release a player (as in, they are a FO or GM)
        let authorized = false
        let authorizedRole;
        const foRoles = await db.all('SELECT roleid, code FROM Roles WHERE (code = "FO" OR code = "GM") AND guild = ?', guild)
        for (const role of foRoles) {
            if (interaction.member.roles.cache.get(role.roleid)) {
                authorized = true
                authorizedRole = role.code
                break
            }
        }

        if (!authorized) {
            await db.close()
            return interaction.editReply({ content: "You are not authorized to release players! To do so, you must be a franchise owner or general manager", ephemeral: true})
        }
        

        if (user.id === interaction.user.id) {
            await db.close()
            return interaction.editReply({ content:"You are not allowed to release yourself!", ephemeral:true })
        }

        // then, check to see if the user is already without a team
        const allTeams = await db.all('SELECT roleid, code FROM Roles WHERE guild = ?', guild)
        let userSigned = false
        let teamSigned
        let teamSignedRoleid;
        let specialRole
        let specialRoleRoleid;
        for (const team of allTeams) {
            if (user.roles.cache.get(team.roleid)) {
                if (team.code === "FO" || team.code === "GM" || team.code === "HC") {
                    specialRole = team.code
                    specialRoleRoleid = team.roleid
                }
                if (!(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                    userSigned = true
                    teamSigned = team.code
                    teamSignedRoleid = team.roleid
                }
                
            }
        }

        if (!userSigned) {
            await db.close()
            return interaction.editReply({ content:"This user is not currently on a team!", ephemeral:true })
        }
        if (specialRole === "FO") {
            await db.close()
            return interaction.editReply({ content:"You cannot release a franchise owner!", ephemeral:true })
        }

        if (authorizedRole === "GM" && specialRole === "HC") {
            await db.close()
            return interaction.editReply({ content:"You cannot release a head coach as a general manager!", ephemeral:true })
        }



        // checks to see if FO or GM is on the same team as player being released
        for (const team of allTeams) {
            if (interaction.member.roles.cache.get(team.roleid)) {
                if (!(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                    if (team.code !== teamSigned) {
                        await db.close()
                        return interaction.editReply({ content:"This user is not on the same team as you!", ephemeral:true })
                    }
                }
                
            }
        }

        // then, release the user
        await user.roles.remove(teamSignedRoleid)
        if (specialRole) {
            await user.roles.remove(specialRoleRoleid)
        }


        // then, get the team logo and player count
        const logo = await db.get('SELECT t.logo FROM Teams t, Roles r WHERE t.code = r.code AND t.guild = r.guild AND r.roleid = ? AND r.guild = ?', [teamSignedRoleid, guild])
        const logoStr = logo.logo;

        // then, get the transaction channel ID and send a transaction message
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        const playerCountQry = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', [guild])

        const roleObj = await interaction.guild.roles.fetch(teamSignedRoleid)

        const transactionEmbed = new EmbedBuilder()
            .setTitle("Player released!")
            .setThumbnail(logoStr)
            .setColor(roleObj.color)
            .setDescription(`The ${roleObj} have released ${user} (${user.user.tag})!
            \n>>> **Coach:** ${interaction.member} (${interaction.user.tag})\n**Roster:** ${roleObj.members.size}/${playerCountQry.maxplayers}`)
            
        if (interaction.user.avatarURL()) {
            transactionEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            transactionEmbed.setFooter({ text: `${interaction.user.tag}` })
        }

        await transactionChannel.send({ embeds: [transactionEmbed] });
        await interaction.editReply({ content:`${user} was successfully released!`, ephemeral:true})
        await db.close();
    }
}
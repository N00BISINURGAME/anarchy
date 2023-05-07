const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { message } = require('noblox.js');


let dmChannel;
let dmMessage;
let userMessage;
const userOption = new SlashCommandUserOption();
userOption.setRequired(true);
userOption.setName('player');
userOption.setDescription('The player to sign');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sign')
        .setDescription('Signs a player to your team.')
        .addUserOption(userOption),
    async execute(interaction) {
        let user = interaction.options.getUser('player')
        let userPing = await interaction.guild.members.fetch(user.id)
        let userid = userPing.id;
        const guild = interaction.guild.id
        const db = await getDBConnection()
        const maxPlayerCount = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guild)
        const maxPlayers = maxPlayerCount.maxplayers
        // const offerEnabled = await db.get('SELECT signings FROM Leagues WHERE guild = ?', guild)
        // if (!offerEnabled.signings) {
        //     await db.close()
        //     return interaction.editReply({ content: "Signings are disabled! You can turn them on by running /toggle.", ephemeral: true})
        // }

        // check if a transaction channel has been set
        const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        if (!transactionExists) {
          await db.close()
            return interaction.editReply({ content: "A transaction channel has not been set! This can be set by running /setup or /channel.", ephemeral: true})
        }

        if (user.id === interaction.user.id) {
          await db.close()
          return interaction.editReply({ content:"You are not allowed to sign yourself!", ephemeral:true })
        }

        // first, check and see if the user that sent the command is authorized to sign a player (as in, they are a FO or GM)
        const userSent = interaction.user.id;
        const allTeams = await db.all('SELECT roleid, code FROM Roles WHERE guild = ?', guild)
        let authorized = false
        let info
        for (const team of allTeams) {
            if (interaction.member.roles.cache.get(team.roleid)) {
                if (team.code === "FO" || team.code === "GM" || team.code === "HC") {
                    authorized = true
                }
                if (!(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                    info = team.code
                }
            }
        }
        if (!authorized) {
            await db.close();
            return interaction.editReply({ content:'You are not authorized to sign a player!', ephemeral:true});
        }

        // then, get the team logo
        const logo = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [info, guild]);
        let logoStr;
        if (!logo) {
            logoStr = interaction.client.user.avatarURL()
        } else {
            logoStr = logo.logo;
        }

        // then, check to see if the user is already signed
        let userSigned = false
        let teamSigned
        for (const team of allTeams) {
            if (userPing.roles.cache.get(team.roleid)) {
                if (!(team.code === "FO" || team.code === "GM" || team.code === "HC" || team.code === "FA" || team.code === "ELIG")) {
                    userSigned = true
                    teamSigned = team.code
                    break
                }
            }
        }
        if (userSigned) {
            // then, get the team that the player is signed on
            const team = await db.get('SELECT roleid FROM roles WHERE code = ? AND guild = ?', [teamSigned, guild]);
            const teamRole = await interaction.guild.roles.fetch(team.roleid);
            await db.close();
            return interaction.editReply({content:`This user has already been signed by the ${teamRole}!`, ephemeral:true});
        }

        const memberTeamRole = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [info, guild])
        if (!memberTeamRole) {
            await db.close()
            return interaction.editReply({content:`The team that you are on does not exist in the database! This may indicate that you need to run /setup.`, ephemeral:true});
        }
        const teamRole = await interaction.guild.roles.fetch(memberTeamRole.roleid)

        if (teamRole.members.size + 1 > maxPlayers) {
          await db.close()
          return interaction.editReply({content:'Signing this player would lead to your team exceeding the maximum player count!', ephemeral:true});
        }

        const eligibleRole = await db.get('SELECT * FROM Roles WHERE code = "ELIG" AND guild = ?', guild)
        if (eligibleRole) {
            const memberRoles = userPing.roles.cache
            if (!memberRoles.get(eligibleRole.roleid)) {
                await db.close()
                return interaction.editReply({content:'This player is not eligible to be signed, since they do not have the eligible role!', ephemeral:true});
            }
        }

        // let dmChannel = await userPing.createDM()

        let dmMessage = new EmbedBuilder()
                .setTitle("Player Signed!")
                .setColor(teamRole.color)
                .setThumbnail(logoStr)
                .setDescription(`The ${teamRole.name} have signed you!
                \n>>> **Coach:** ${interaction.user.tag}\n**League:** ${interaction.guild.name}`)
            if (interaction.user.avatarURL()) {
                dmMessage.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
            } else {
                dmMessage.setFooter({ text: `${interaction.user.tag}` })
            }

        try {
            await userPing.roles.add(teamRole)
        } catch(err) {
            if (err.code === 50013) {
                await interaction.editReply({ content: "This bot does not have permission to grant roles to server members! Ensure that the bot has administrator and the role position of the bot is very high (ideally below your founder role).", ephemeral:true })
            } else {
                const errmsg = `There was an error while executing ${interaction.commandName}! Please DM Donovan#3771 with a screenshot of this error to report this bug.\n\n Attach this error message below:\`\`\`${err}\`\`\``
                await interaction.editReply({ content:errmsg, ephemeral:true })
            }
            await db.close()
            return
        }
        // await dmChannel.send({ embeds:[dmMessage] })
        

        // then, get the transaction channel ID and send a transaction message
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        dmMessage.setDescription(`The ${teamRole} have successfully signed ${userPing} \`${userPing.user.tag}\`!
        \n>>> **Coach:** ${interaction.member} \`${interaction.user.tag}\`\n**Roster:** \`${teamRole.members.size}/${maxPlayers}\``)

        await transactionChannel.send({ embeds:[dmMessage] })

        const faRole = await db.get('SELECT * FROM Roles WHERE code = "FA" AND guild = ?', guild)
        if (faRole) {
            await userPing.roles.remove(faRole.roleid)
        }

        await db.close()

        return interaction.editReply({content:`${userPing} has been successfully signed!`, ephemeral:true});
    }
}
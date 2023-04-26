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
        .setName('offer')
        .setDescription('Offer to sign a player to a team.')
        .addUserOption(userOption),
    async execute(interaction) {
        let pingedUser = interaction.options.getMember('player')
        if (!pingedUser) {
            return interaction.editReply({ content:"This user may have left the server! Ensure they are in the server, and contact Donovan#3771 if you believe this is a mistake.", ephemeral:true})
        }
        let userid = pingedUser.id;
        const guild = interaction.guild.id
        try {
            const db = await getDBConnection();
            const maxPlayerCount = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guild)
            const maxPlayers = maxPlayerCount.maxplayers
            const offerEnabled = await db.get('SELECT offers FROM Leagues WHERE guild = ?', guild)
            if (!offerEnabled.offers) return interaction.editReply({ content: "Offers are disabled!", ephemeral: true})

            // check if a transaction channel has been set
            const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
            if (!transactionExists) {
                await db.close()
                return interaction.editReply({ content: "A transaction channel has not been set!", ephemeral: true})
            }

            // gets all information that the user sent
            let userPing = interaction.options.getMember('player');
            let user = await interaction.guild.members.fetch(userPing.id)
            let userid = user.id;

            if (user.id === interaction.user.id) {
                await db.close()
                return interaction.editReply({ content:"You are not allowed to offer yourself!", ephemeral:true })
            }

            // first, check and see if the user that sent the command is authorized to sign a player (as in, they are a FO or GM)
            const userSent = interaction.user.id;
            const allTeams = await db.all('SELECT roleid, code FROM Roles WHERE guild = ?', guild)
            if (allTeams.length === 0) {
                await db.close()
                return interaction.editReply({ content:"There are no teams in this league! This may indicate you need to run /setup.", ephemeral:true })
            }
            let authorized = false
            let info
            for (const team of allTeams) {
                if (interaction.member.roles.cache.get(team.roleid)) {
                    if (team.code === "FO" || team.code === "GM") {
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

            // then, check if the user already has an outgoing offer
            const existingOffer = await db.get("SELECT * FROM Offers where discordid = ?", user.id);
            if (existingOffer) {
                await db.close();
                return interaction.editReply({ content:"This user already has an outgoing offer. Please try again later.", ephemeral:true })
            }

            // then, get the team logo
            const logo = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [info, guild]);
            let logoStr;
            if (!logo) {
                logoStr = interaction.client.user.avatarURL()
            } else {
                logoStr = logo.logo;
            }

            // get role id
            const role = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [info, guild]);
            if (!role) {
                await db.close()
                return interaction.editReply({ content:"The team you are on does not exist in the database! This may indicate you need to run /setup.", ephemeral:true })
            }
            const roleObj = await interaction.guild.roles.fetch(role.roleid)

            if (!roleObj) {
                await db.close()
                return interaction.editReply({content:'The role that is associated with your team does not exist in the database! This may mean you need to run /setup.', ephemeral:true});
            }

            // then, check to see if the user is already signed
            let userSigned = false
            let teamSigned
            for (const team of allTeams) {
                if (userPing.roles.cache.get(team.roleid)) {
                    if (!(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                        userSigned = true
                        teamSigned = team.code
                        break
                    }
                    
                }
            }
            if (userSigned) {
                // then, get the team that the player is signed on
                const team = await db.get('SELECT roleid FROM roles WHERE code = ? AND guild = ?', [teamSigned, guild]);
                if (!team) {
                    await db.close()
                    return interaction.editReply({ content:"The team that the player you want to offer is on does not exist in the database! This may be a sign that you need to run /setup.", ephemeral:true })
                }
                const teamRole = await interaction.guild.roles.fetch(team.roleid);
                await db.close();
                return interaction.editReply({content:`This user has already been signed by the ${teamRole}!`, ephemeral:true});
            }

            const memberTeamRole = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [info, guild])
            if (!memberTeamRole) {
                await db.close()
                return interaction.editReply({ content:"The team you are on does not exist in the database! This may indicate you need to run /setup.", ephemeral:true })
            }
            const teamRole = await interaction.guild.roles.fetch(memberTeamRole.roleid)
            if (!teamRole) {
                await db.close()
                return interaction.editReply({content:'The role that is associated with your team does not exist in the database! This may mean you need to run /setup.', ephemeral:true});
            }

            if (teamRole.members.size + 1 > maxPlayers) {
                await db.close()
                return interaction.editReply({content:'Signing this player would lead to your team exceeding the maximum player count!', ephemeral:true});
            }

            // then, get channel information and send an ephemeral reply to the command saying a user has been offered
            // also create the dm message, format it properly, and send it to the user and listen for a button click
            dmChannel = await userPing.createDM()

            dmMessage = new EmbedBuilder()
                .setTitle("Incoming Offer!")
                .setColor(teamRole.color)
                .setThumbnail(logoStr)
                .setDescription(`The ${teamRole.name} have sent you an offer! To accept or decline, press the green or red button on this message. You have 15 minutes to accept.
                \n>>> **Coach:** ${interaction.user.tag}\n**League:** ${interaction.guild.name}`)
            if (interaction.user.avatarURL()) {
                dmMessage.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
            } else {
                dmMessage.setFooter({ text: `${interaction.user.tag}` })
            }

            const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('accept')
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('decline')
                            .setLabel('Decline')
                            .setStyle(ButtonStyle.Danger)
                    )

            userMessage = await dmChannel.send({embeds: [dmMessage], components: [buttons]})
            await db.run("INSERT INTO Offers (discordid) VALUES (?)", user.id);
            await interaction.editReply({ content: "Offer has been sent. Awaiting decision...", ephemeral: true})
            const dmInteraction = await userMessage.awaitMessageComponent({ componentType: ComponentType.Button, time: 890000})

            if (dmInteraction.customId === "accept") {
                // check again to see if player count would be exceeded
                const newMaxPlayers = await interaction.guild.roles.fetch(memberTeamRole.roleid)
                if (newMaxPlayers.members.size + 1 > maxPlayers) {
                    const failEmbed = new EmbedBuilder()
                        .setTitle("Signing failed")
                        .setDescription(`${info.team} has signed too many players, and can no longer sign you without going over the maximum player cap.`)
                        await db.close()
                    return dmInteraction.update({ embeds: failEmbed, components: [] })
                }

                // check if the player signed to another team
                let playerResigned = false
                for (const role of userPing.roles.cache.keys()) {
                    const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
                    if (roleExists) {
                        if (!(roleExists.code === "FO" || roleExists.code === "GM" || roleExists.code === "HC")) {
                            playerResigned = true
                            break
                        }
                    }
                }
                if (playerResigned) {
                    const failEmbed = new EmbedBuilder()
                        .setTitle("Signing failed")
                        .setDescription(`You have already signed to another team.`)
                    await db.close()
                    return dmInteraction.update({ embeds: failEmbed, components: [] })
                }

                await userPing.roles.add(roleObj);

                // then, get the transaction channel ID and send a transaction message
                const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)

                const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

                const transactionEmbed = new EmbedBuilder()
                    .setTitle("Player Offered!")
                    .setColor(roleObj.color)
                    .setThumbnail(logoStr)
                    .setDescription(`The ${roleObj} have successfully offered ${userPing} (${userPing.user.tag})!
                    \n>>> **Coach:** ${interaction.member} (${interaction.user.tag})\n**Roster:** ${roleObj.members.size}/${maxPlayers}`)
                
                if (interaction.user.avatarURL()) {
                    transactionEmbed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
                } else {
                    transactionEmbed.setFooter({ text: `${interaction.user.tag}` })
                }

                dmMessage.setTitle("Successfully signed!")

                await dmInteraction.update({ embeds: [dmMessage], components: []})
                await interaction.editReply({ content:"Offer accepted!", ephemeral:true })
                await transactionChannel.send({ embeds: [transactionEmbed] })
            } else if (dmInteraction.customId === "decline") {
                dmMessage.setTitle("Offer rejected!")
                await dmInteraction.update({ embeds: [dmMessage], components: [] })
                await interaction.editReply({ content:"Offer rejected!", ephemeral:true })
            } else {
                
                await dmInteraction.update({ content:"An error has occured! Please ask your FO to send another offer", components: [] })
                await interaction.editReply({ content:"Error, please DM Donovan#3771 with a description of what happened", ephemeral:true })
            }
            await db.run("DELETE FROM Offers WHERE discordid = ?", user.id);
            await db.close();
        } catch(err) {
            await interaction.client.users.send("168490999235084288", `Error for user ${interaction.user.tag}\n\n ${err.stack}`)
            console.log(err)
            const db = await getDBConnection();
            await db.run("DELETE FROM Offers WHERE discordid = ?", userid);
            if (err.code === "InteractionCollectorError") {
                dmMessage.setTitle("Offer Expired!")
                await userMessage.edit({ embeds: [dmMessage], components: []})
             } else if (err.code === 50007) {
                await interaction.editReply({ content: "This user does not have their DMs open to bots! Ensure that this user can be DMed by bots before sending them another offer!", ephemeral:true })
            } else {
                const errmsg = `There was an error while executing ${interaction.commandName}! Please DM Donovan#3771 with a screenshot of this error to report this bug.\n\n Attach this error message below:\`\`\`${err}\`\`\``
                await interaction.editReply({ content:errmsg, ephemeral:true })
            }
            await db.close();
        }
    }
}
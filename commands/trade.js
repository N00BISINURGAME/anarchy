const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandIntegerOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { maxPlayers } = require('../config.json');
const { message } = require('noblox.js');

const playerTradedOption = new SlashCommandUserOption()
        .setRequired(true)
        .setName("player-traded-away")
        .setDescription("The player you want to trade to the other team")

const playerWantedOption = new SlashCommandUserOption()
        .setRequired(true)
        .setName("player-you-want")
        .setDescription("The player you want to trade for")


module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade between two teams')
        .addUserOption(playerTradedOption)
        .addUserOption(playerWantedOption),
    async execute(interaction) {
        const db = await getDBConnection();
        let userid = interaction.user.id;
        const guild = interaction.guild.id
        const player1 = interaction.options.getUser("player-traded-away")
        const player1Member = await interaction.guild.members.fetch(player1.id)
        const player2 = interaction.options.getUser("player-you-want")
        const player2Member = await interaction.guild.members.fetch(player2.id)

        // check if a transaction channel has been set
        const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        if (!transactionExists) {
            await db.close()
            return interaction.editReply({ content: "A transaction channel has not been set! This can be set by running /setup or /channel.", ephemeral: true})
        }

        // first, check if the user is allowed to trade people
        const allTeams = await db.all('SELECT roleid, code FROM Roles WHERE guild = ?', guild)
        let authorized = false
        let info
        let infoRoleid
        for (const team of allTeams) {
            if (interaction.member.roles.cache.get(team.roleid)) {
                if (team.code === "FO" || team.code === "GM") {
                    authorized = true
                }
                if (!(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                    info = team.code
                    infoRoleid = team.roleid
                }
            }
        }
        if (!authorized) {
            await db.close();
            return interaction.editReply({ content:'You are not authorized to trade players!', ephemeral:true});
        }
        if (!info) {
            await db.close()
            return interaction.editReply({ content:"You are not on a team! If you believe this is a mistake, you may need to run /setup.", ephemeral: true})
        }

        // then, check that either of the players are not being traded. do this later
        // need to create a trades table in our database
        const player1Traded = await db.get('SELECT * FROM Trades WHERE discordid = ? AND guild = ?', [player1.id, guild])
        const player2Traded = await db.get('SELECT * FROM Trades WHERE discordid = ? AND guild = ?', [player2.id, guild])
        if (player1Traded && player2Traded) {
            await db.close()
            return interaction.editReply({ content:`${player1} and ${player2} are currently involved in other trades! Please try again later!`, ephemeral: true})
        } else if (player1Traded) {
            await db.close()
            return interaction.editReply({ content:`${player1} is currently involved in another trade! Please try again later!`, ephemeral: true})
        } else if (player2Traded) {
            await db.close()
            return interaction.editReply({ content:`${player2} is currently involved in another trade! Please try again later!`, ephemeral: true})
        }

        // then, check if the player pinged is on the same team as the player that started the command
        const player1Authorized = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [info, guild])
        if (!player1Member.roles.cache.get(player1Authorized.roleid)) {
            await db.close()
            return interaction.editReply({ content:"The player you want to trade to the other team is not on your team!", ephemeral: true})
        }
        for (const team of allTeams) {
            if (player1Member.roles.cache.get(team.roleid)) {
                if (team.code === "FO" || team.code === "GM" || team.code === "HC") {
                    await db.close()
                    return interaction.editReply({ content:"You are unable to trade away front office players! Please demote them and try again!", ephemeral: true})
                }
            }
        }

        // then, get information on player 2
        let player2FrontOffice = false
        let player2Info;
        let player2Roleid;
        for (const team of allTeams) {
            if (player2Member.roles.cache.get(team.roleid)) {
                if (team.code === "FO" || team.code === "GM") {
                    player2FrontOffice = true
                }
                if (!(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                    player2Info = team.code
                    player2Roleid = team.roleid
                }
            }
        }

        // check if player 2 is a free agent
        if (!player2Info) {
            await db.close()
            return interaction.editReply({ content:"The player you want to trade for is a free agent!", ephemeral: true})
        }

        // then, check if they are front office
        if (player2FrontOffice) {
            await db.close()
            return interaction.editReply({ content:"You are unable to trade for front office players! Please have them demoted and try again!", ephemeral: true})
        }

        // then, get the franchise owner of the team that 
        const guildFoCode = await db.get('SELECT roleid FROM Roles WHERE code = "FO" AND guild = ?', guild)
        const foRole = await interaction.guild.roles.fetch(guildFoCode.roleid)
        let otherTeamFo;
        for (const member of foRole.members.values()) {
            if (member.roles.cache.get(player2Roleid)) {
                otherTeamFo = member
                break
            }
        }
        if (!otherTeamFo) {
            await db.close()
            return interaction.editReply({ content:"The team of the player you want to trade for does not have a franchise owner!", ephemeral: true})
        }

        // then, construct the embed
        const offeringTeam = await db.get('SELECT name, logo FROM Teams WHERE code = ? AND guild = ?', [info, guild])

        const offeringTeamRole = await interaction.guild.roles.fetch(infoRoleid)

        const embed = new EmbedBuilder()
            .setTitle("Incoming trade offer!")
            .setColor(offeringTeamRole.color)
            .setDescription(`The ${offeringTeam.name} have offered you a trade in ${interaction.guild.name}! You have 15 minutes to accept or decline.
            \n>>> **Players you will receive:** ${player1.tag}\n**Players you will trade away:** ${player2.tag}`)
            .setThumbnail(`${offeringTeam.logo}`)
        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
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

        const dmChannel = await otherTeamFo.createDM()
        const message = await dmChannel.send({ embeds:[embed], components:[buttons] })
        await interaction.editReply({ content: "Trade has been sent. Awaiting decision...", ephemeral: true})
        // put both players into the trade db
        await db.run('INSERT INTO Trades(discordid, guild) VALUES(?, ?)', [player1.id, guild])
        await db.run('INSERT INTO Trades(discordid, guild) VALUES(?, ?)', [player2.id, guild])
        try {
            const dmInteraction = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 890000})
            const otherTeam = await interaction.guild.roles.fetch(player2Roleid)
            console.log(otherTeam)
            console.log(offeringTeam)

            await db.run('DELETE FROM Trades WHERE (discordid = ? OR discordid = ?) AND guild = ?', [player1.id, player2.id, guild])
            if (dmInteraction.customId === "accept") {
                // confirm that the players are still on their respective teams
                if (!player1Member.roles.cache.get(infoRoleid)) {
                    await db.close()
                    embed.setTitle("Trade failed!")
                    embed.setDescription(`${player1Member} is no longer on the ${offeringTeamRole.name}!`)
                    await dmInteraction.update({ embeds:[embed], components:[] })
                    return interaction.editReply({ content:`${player1Member} is no longer on their team!`, ephemeral: true})
                }
                if (!player2Member.roles.cache.get(player2Roleid)) {
                    await db.close()
                    embed.setTitle("Trade failed!")
                    embed.setDescription(`${player2Member} is no longer on the ${otherTeam.name}!`)
                    await dmInteraction.update({ embeds:[embed], components:[] })
                    return interaction.editReply({ content:`${player1Member} is no longer on their team!`, ephemeral: true})
                }

                await player1Member.roles.remove(offeringTeamRole)
                await player1Member.roles.add(otherTeam)
                await player2Member.roles.remove(otherTeam)
                await player2Member.roles.add(offeringTeamRole)

                embed.setTitle('Trade successfully executed!')
                await dmInteraction.update({ embeds:[embed], components:[] })
                await interaction.editReply({ content:"Trade successful!", ephemeral: true})
                embed.setTitle("Trade Processed!")
                embed.setDescription(`The ${offeringTeamRole} have conducted a trade with the ${otherTeam}!
                \n>>> **${offeringTeam.name} receives:** ${player2Member} \`${player2.tag}\`\n**${otherTeam.name} receives:** ${player1Member} \`${player1.tag}\`\n**${offeringTeamRole.name} coach:** ${interaction.member} \`${interaction.user.tag}\`\n**${otherTeam.name} coach:** ${otherTeamFo} \`${otherTeamFo.user.tag}\``)

                // then, get the transaction channel ID and send a transaction message
                const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)

                const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

                await transactionChannel.send({ embeds:[embed] })

                //ìf (!(player1Cònfirm.team === player1Authorized.team))
            } else if (dmInteraction.customId === "decline") {
                embed.setTitle("Trade rejected!")
                await dmInteraction.update({ embeds:[embed], components:[] })
                await interaction.editReply({ content:"Trade rejected!", ephemeral: true})
            }
            await db.close()
        } catch(err) {
            console.log(err)
            await db.run("DELETE FROM Trades WHERE (discordid = ? OR discordid = ?) AND guild = ?", [player1.id, player2.id, guild]);
            if (err.code === "InteractionCollectorError") {
                embed.setTitle("Trade Expired!")
                await message.edit({ embeds: [embed], components: []})
             } else if (err.code === 50007) {
                await interaction.editReply({ content: "This user does not have their DMs open to bots! Ensure that this user can be DMed by bots before sending them another trade!", ephemeral:true })
            } else {
                throw new Error(err)
            }
            await db.close();
        }

    }
}
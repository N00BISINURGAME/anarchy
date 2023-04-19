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
        .setDescription('Trade between two teams'),
    async execute(interaction) {
        const db = await getDBConnection();
        let userid = interaction.user.id;
        const guild = interaction.guild.id
        const player1 = interaction.options.getUser("player-traded-away")
        const player2 = interaction.options.getUser("player-you-want")
        if (userid !== "168490999235084288") {
            await db.close()
            return interaction.editReply({ content:"Not implemented yet!", ephemeral: true})
        }

        // first, check if the user is allowed to sign people
        const authorized = await db.get('SELECT * FROM Players WHERE discordid = ? AND (role = "FO" OR role = "GM") AND guild = ?', [userid, guild])
        if (!authorized) {
            await db.close()
            return interaction.editReply({ content:"You are not authorized to trade players!", ephemeral: true})
        }

        // then, check that either of the players are not being traded. do this later
        // need to create a trades table in our database
        const player1Traded = await db.get('SELECT * FROM Trades WHERE discordid = ? AND guild = ?', [player1.id, guild])
        const player2Traded = await db.all('SELECT * FROM Trades WHERE discordid = ? AND guild = ?', [player2.id, guild])
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
        const player1Authorized = await db.get('SELECT * FROM Players WHERE discordid = ? AND team = (SELECT team FROM Players WHERE discordid = ? AND guild = ?) AND guild = ?', [player1.id, userid, guild, guild])
        if (!player1Authorized) {
            await db.close()
            return interaction.editReply({ content:"The player you want to trade to the other team is not on your team!", ephemeral: true})
        }

        if (player1Authorized.role !== "P") {
            await db.close()
            return interaction.editReply({ content:"You are unable to trade away front office players! Please demote them and try again!", ephemeral: true})
        }

        // then, get information on player 2
        const player2Info = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [player2.id, guild]) // always assume player 2 exists

        // check if player 2 is a free agent
        if (player2Info.team === "FA") {
            await db.close()
            return interaction.editReply({ content:"The player you want to trade for is a free agent!", ephemeral: true})
        }

        // then, check if they are front office
        if (player2Info.role !== "P") {
            await db.close()
            return interaction.editReply({ content:"You are unable to trade for front office players! Please have them demoted and try again!", ephemeral: true})
        }

        // then, get the franchise owner of the team that 
        const otherTeamFo = await db.get('SELECT * FROM Players WHERE role = "FO" AND team = ? AND guild = ?', [player2Info.team, guild])
        if (!otherTeamFo) {
            await db.close()
            return interaction.editReply({ content:"The team of the player you want to trade for does not have a franchise owner!", ephemeral: true})
        }

        // then, construct the embed
        const offeringTeam = await db.get('SELECT name, logo FROM Teams WHERE code = ? AND guild = ?', [authorized.team, guild])

        const embed = new EmbedBuilder()
            .setTitle("Incoming trade offer!")
            .setDescription(`The ${offeringTeam.name} have offered you a trade! You have 15 minutes to accept or decline.`)
            .setThumbnail(`${offeringTeam.logo}`)
            .setFields(
                { name:"Players you will receive", value:`${player1.tag}`},
                { name:"Players you will trade away", value:`${player2.tag}`}
            )
            .setFooter({ text:`This trade was sent by ${interaction.user.tag}`})

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

        const otherFo = await interaction.guild.members.fetch(otherTeamFo.discordid)
        const dmChannel = await otherFo.createDm()
        const message = await dmChannel.send({ embeds:[embed], compoenents:[buttons] })
        await interaction.editReply({ content: "Trade has been sent. Awaiting decision...", ephemeral: true})
        // put both players into the trade db
        await db.run('INSERT INTO Trades(discordid, guild) VALUES(?, ?)', [player1.id, guild])
        await db.run('INSERT INTO Trades(discordid, guild) VALUES(?, ?)', [player2.id, guild])
        try {
            const dmInteraction = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 890000})
            if (dmInteraction.customId === "accept") {
                // confirm that the players are still on their respective teams
                const player1Confirm = await db.get('SELECT * FROM Players WHERE discordid = ? AND team = ? AND guild = ?', [player1.id, player1Authorized.team, guild])
                const player2Confirm = await db.get('SELECT * FROM Players WHERE discordid = ? AND team = ? AND guild = ?', [player2.id, player2Info.team, guild])
            }
        } catch(err) {
            await interaction.client.users.send("168490999235084288", `Error for user ${interaction.user.tag}\n\n ${err}`)
            console.log(err)
            await db.run("DELETE FROM Offers WHERE discordid = ?", userid);
            if (err.code === "InteractionCollectorError") {
                embed.setTitle("Offer Expired!")
                await message.edit({ embeds: [dmMessage], components: []})
             } else if (err.code === 50007) {
                await interaction.editReply({ content: "This user does not have their DMs open to bots! Ensure that this user can be DMed by bots before sending them another trade!", ephemeral:true })
            } else {
                throw new Error(err)
            }
            await db.close();
        }
        
        await db.close();
    }
}
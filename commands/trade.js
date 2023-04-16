const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandIntegerOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { maxPlayers } = require('../config.json');
const { message } = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade between two teams'),
    async execute(interaction) {
        let userid = interaction.user.id;
        const guild = interaction.guild.id
        if (userid !== "168490999235084288") {
            return interaction.editReply({ content:"Not implemented yet!", ephemeral: true})
        }
        const db = await getDBConnection();
        // first, check if the user is allowed to sign people
        const authorized = await db.get('SELECT * FROM Players WHERE discordid = ? AND (role = "FO" OR role = "GM") AND guild = ?', [userid, guild])
        if (!authorized) {
            return interaction.editReply({ content:"You are not authorized to trade players!", ephemeral: true})
        }
        // then, prompt the user
        await interaction.editReply({ content:"Ping up to 3 users you'd like to offer, or type 'cancel' to cancel this trade. You have 15 minutes to complete the whole trade.", ephemeral:true })
        const filter = m => m.author.id = interaction.user.id
        const offerCollector = interaction.channel.createMessageCollector({ filter, time: 899000})

        // collect messages -- maybe change the way that trades are done by making it such that
        // it entirely uses ephemeral messages
        // process would be something like: user sends message -> message deleted / saved -> ephemeral
        // message updated -> rinse and repeat
        let team1Players
        let team2Players
        let userMessage
        offerCollector.on("collect", async m => {
            try {
                const db = await getDBConnection();
                let team;
                // first, check if the user prompts for cancel
                if (m.content.match(/[a-zA-Z]/)) {
                    await db.close()
                    offerCollector.stop()
                    if (m.content === "cancel") {
                        m.delete()
                    }
                    return interaction.editReply({content:"Trade has been canceled!", ephemeral:true})
                }
                // then, check how many players the user pinged
                const userArr = m.content.split(/\s+/)
                if (userArr.length > 3) {
                    await db.close()
                    m.delete()
                    offerCollector.stop()
                    return interaction.editReply({content:"Aborted! You have exceeded the maximum trade limit!", ephemeral:true})
                }
                if (!team1Players) {
                    // then, get all users pinged
                    for (let i = 0; i < userArr.length; i++) {
                        const user = userArr[i]
                        const userid = user.match(/\d{18}/)[0]
                        if (!userid) {
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:"Aborted! Ensure you are pinging valid users!", ephemeral:true})
                        }
                        // now, check to see if theyre on the same team as the person running the command
                        const userInfo = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [userid, guild])
                        if (!userInfo || !(userInfo.team === authorized.team)) {
                            await db.close()
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:`Aborted! ${user} is unable to be traded!`, ephemeral:true})
                        }
                        if (userInfo.role !== "P") {
                            await db.close()
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:`Aborted! ${user} is unable to be traded!`, ephemeral:true})
                        }
                    }
                } else {
                    // then, get all users pinged
                    for (let i = 0; i < userArr.length; i++) {
                        const user = userArr[i]
                        const userid = user.match(/\d{18}/)[0]
                        if (!userid) {
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:"Aborted! Ensure you are pinging valid users!", ephemeral:true})
                        }
                        // now, check to see if theyre on the same team as the person running the command
                        const userInfo = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [userid, guild])
                        if (!userInfo) {
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:`Aborted! ${user} is unable to be traded!`, ephemeral:true})
                        }
                        // then, check if theyre on the same team as the other players
                        if (!team) {
                            team = userInfo.team;
                        }
                        if (team !== userInfo.team) {
                            await db.close()
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:`Aborted! ${user} is unable to be traded!`, ephemeral:true})
                        }
                        if (userInfo.role !== "P") {
                            await db.close()
                            m.delete()
                            offerCollector.stop()
                            return interaction.editReply({content:`Aborted! ${user} is unable to be traded!`, ephemeral:true})
                        }
                    }
                }
                if (!team1Players) {
                    team1Players = userArr
                } else {
                    team2Players = userArr
                }
                m.delete()
                await interaction.editReply({content:`Now, ping 3 players that you want. They must all be on the same team.`, ephemeral:true})
                if (team1Players && team2Players) {
                    console.log("going into if branch for team players")
                    console.log(team1Players)
                    console.log(team2Players)
                    // we need to check to see if trading any players would make teams exceed their player cap
                    // team 1 represents the team of the person initiating the trade, team 2 represents the team
                    // of the person who needs to accept/decline the trade
                    // use the offer table here to make sure that a trade is not pending
                    const team1 = await db.get("SELECT * FROM Teams WHERE code = ? AND guild = ?", [authorized.team, guild])
                    const team2 = await db.get("SELECT * FROM Teams WHERE code = ? AND guild = ?", [team, guild])
                    const team1Size = team1.playercount
                    const team2Size = team2.playercount
                    if (team1Size + team2Players.length - team1Players.length > maxPlayers) {
                        await db.close()
                        m.delete()
                        offerCollector.stop()
                        return interaction.editReply({content:`Aborted! Your team would exceed the player cap by making this trade!`, ephemeral:true})
                    }
                    if (team2Size + team1Players.length - team2Players.length > maxPlayers) {
                        await db.close()
                        m.delete()
                        offerCollector.stop()
                        return interaction.editReply({content:`Aborted! The other team would exceed the player cap by making this trade!`, ephemeral:true})
                    }
                    const team1Roleid = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [authorized.team, guild])
                    const team2Roleid = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [team, guild])
                    const team1Role = await interaction.guild.roles.fetch(team1Roleid.roleid)
                    const team2Role = await interaction.guild.roles.fetch(team2Roleid.roleid)

                    let team1Str = ""
                    let team2Str = ""
                    for (let i = 0; i < team1Players.length; i++) {
                        const user = team1Players[i]
                        const userid = user.match(/\d{18}/)[0]
                        const userFetched = await interaction.guild.members.fetch(userid);
                        team1Str += userFetched.user.tag + "\n"
                    }
                    for (let i = 0; i < team2Players.length; i++) {
                        const user = team2Players[i]
                        const userid = user.match(/\d{18}/)[0]
                        const userFetched = await interaction.guild.members.fetch(userid);
                        team2Str += userFetched.user.tag + "\n"
                    }

                    console.log(team1Str)
                    console.log(team2Str)
                    // then, format the embed that would be sent to the other team
                    const embed = new EmbedBuilder()
                        .setTitle("Incoming trade offer!")
                        .setDescription(`The ${team1Role.name} have offered you a trade! You have 15 minutes to accept or decline.`)
                        .setFields(
                            {name:"Players you will receive:", value:`${team1Str}`},
                            {name:"Players you will trade away:", value:`${team2Str}`}
                        )
                        .setFooter({text:`This trade was sent by ${interaction.user.tag}`})

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

                    const otherFO = await db.get('SELECT discordid FROM Players WHERE role = "FO" AND team = ? AND guild = ?', [team, guild])
                    if (!otherFO) {
                        await db.close()
                        m.delete()
                        offerCollector.stop()
                        return interaction.editReply({content:`Aborted! This team does not have a franchise owner!`, ephemeral:true})
                    }

                    const foUser = await interaction.guild.members.fetch(otherFO.discordid);

                    const dmChannel = await foUser.createDM()

                    // todo: create trades table or just use offers table
                    userMessage = await dmChannel.send({embeds: [embed], components: [buttons]})
                    // await db.run("INSERT INTO Offers (discordid) VALUES (?)", user.id);
                    await interaction.editReply({ content: "Trade has been sent. Awaiting decision...", ephemeral: true})
                    const dmInteraction = await userMessage.awaitMessageComponent({ componentType: ComponentType.Button, time: 890000})
                    offerCollector.stop()
                    // this needs to be implemented
                    if (dmInteraction.customId === "accept") {
                        // first, check if all players remained on their teams
                        for (let i = 0; i < team1Players.length; i++) {
                            console.log(team1Players[i])
                        }
                        for (let i = 0; i < team2Players.length; i++) {
                            console.log(team2Players[i])
                        }
                    }
                }
                await db.close()
            } catch(err) {
                console.log(err)
                await interaction.editReply({ content:`${err}`, ephemeral:true })
                offerCollector.stop()
            }
        })
        await db.close();
    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {
    SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, ChannelType,
    ComponentType, ButtonStyle, ActionRowBuilder, ButtonBuilder
      } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers, maxPlayers } = require('../config.json');

const deadlineOption = new SlashCommandStringOption().setRequired(true).setName("deadline").setDescription("The deadline to play games");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Generates a schedule for that week.')
        .addStringOption(deadlineOption),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id
        const deadline = interaction.options.getString('deadline')

        // then, check if schedule is enabled
        const scheduleChannel = await db.get("SELECT channelid FROM Channels WHERE purpose = ? AND guild = ?", ["schedules", guild]);
        if (!scheduleChannel) {
            await db.close()
            return interaction.editReply({ content:"Schedules are currently disabled!", ephemeral:true })
        }
        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        if (!admin) {
            await db.close()
            return interaction.editReply({ content:"You are not authorized to run this command!", ephemeral:true })
        }

        // then, generate the schedule
        let teamsArr = []
        const teams = await db.all('SELECT roleid, code FROM Roles WHERE guild = ?', guild)
        for (const team of teams) {
            const roleExists = await interaction.guild.roles.fetch(team.roleid)
            if (roleExists && !(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                teamsArr.push(roleExists)
            }
        }

        shuffleArray(teamsArr)
        let byeWeekTeam;
        if (teamsArr.length % 2 === 1) {
            byeWeekTeam = teamsArr.pop()
        }

        let gameStr = ""

        while (teamsArr.length > 0) {
            gameStr += `${teamsArr.pop()} vs ${teamsArr.pop()}\n`
        }

        if (gameStr === "") {
            gameStr = "No games are scheduled!"
        }

        // then, construct the embed
        const embed = new EmbedBuilder()
                        .setTitle("Incoming schedule!")
                        .setColor([0,0,0])
                        .setDescription(`This week's schedule has been released! All games must be played before **${deadline}**.
                        \n${byeWeekTeam ? `The ${byeWeekTeam} have a bye this week!\n\n` : ""}**Schedule:**\n${gameStr}\n>>> **Admin:** ${interaction.member} (${interaction.user.tag})`)

        if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }
        // tomorrow, add a button to make channels

        const genButton = new ButtonBuilder()
                            .setCustomId('generate')
                            .setLabel('Generate threads!')
                            .setStyle(ButtonStyle.Success)

        const deleteButton = new ButtonBuilder()
                            .setCustomId('delete')
                            .setLabel('Delete threads!')
                            .setStyle(ButtonStyle.Danger)

        const buttons = new ActionRowBuilder()
                    .addComponents(
                        genButton,
                        deleteButton
                    )

        const channel = await interaction.guild.channels.fetch(scheduleChannel.channelid)
        const message = await channel.send({ embeds:[embed], components:[buttons]})

        await interaction.editReply({ content:`Successfully posted schedule!`, ephemeral:true })

        const filter = async i => {
            const db = await getDBConnection()
            const admin = await db.get('SELECT * from Admins WHERE discordid = ? AND guild = ?', [i.user.id, guild])
            const manager = await db.get('SELECT * from Managers WHERE discordid = ? AND guild = ?', [i.user.id, guild])
            return admin !== undefined || manager !== undefined || i.user.id === interaction.user.id
        }

        const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 7e8 });

        collector.on("collect", async i => {
            const db = await getDBConnection()
            if (i.customId === "generate") {
                const teams = gameStr.split("\n")
                // teams should **always** be length of 2
                for (const team of teams) {
                    const regex = /\d{17,}/g
                    const twoTeams = team.match(regex)
                    const firstTeam = await interaction.guild.roles.fetch(twoTeams[0])
                    const secondTeam = await interaction.guild.roles.fetch(twoTeams[1])
                    const thread = await channel.threads.create({
                        name:`${firstTeam.name} vs ${secondTeam.name}`,
                        type: ChannelType.PrivateThread
                    })
                    for (const member of firstTeam.members.values()) {
                        const roles = member.roles.cache
                        for (const role of roles.keys()) {
                            const frontOffice = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
                            if (frontOffice.code === "FO" || frontOffice.code === "GM" || frontOffice.code === "HC") {
                                await thread.members.add(member)
                            }
                        }
                    }
                    for (const member of secondTeam.members.values()) {
                        const roles = member.roles.cache
                        for (const role of roles.keys()) {
                            const frontOffice = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
                            if (frontOffice.code === "FO" || frontOffice.code === "GM" || frontOffice.code === "HC") {
                                await thread.members.add(member)
                            }
                        }
                    }
                    await thread.send(`${team}: Schedule your game here!`)
                }
                genButton.setDisabled(true)
                await collector.update({ embeds:[embed], components:[buttons]})
            } else {
                for (const channel of channel.threads.cache.values()) {
                    await channel.delete()
                }
                await collector.update({ embeds:[embed], components:[]})
                collector.stop()
            }
            await db.close()
        })

        await db.close()
    }
}

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
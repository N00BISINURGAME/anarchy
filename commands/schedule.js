const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {
    SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, SlashCommandRoleOption,
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
                        \n${byeWeekTeam ? `The ${byeWeekTeam} have a bye this week!` : ""}\n\n**Schedule:**${gameStr}\n>>> **Admin:** ${interaction.member} (${interaction.user.tag})`)

        if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }


        const channel = await interaction.guild.channels.fetch(scheduleChannel.channelid)
        const message = await channel.send({ embeds:[embed]})

        await interaction.editReply({ content:`Successfully posted schedule!`, ephemeral:true })

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
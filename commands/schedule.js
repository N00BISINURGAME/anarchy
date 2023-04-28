const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {
    SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, SlashCommandRoleOption,
    ComponentType, ButtonStyle, ActionRowBuilder, ButtonBuilder
      } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers, maxPlayers } = require('../config.json');

const team1Option = new SlashCommandRoleOption().setRequired(true).setName("team-1").setDescription("The first team");
const team2Option = new SlashCommandRoleOption().setRequired(true).setName("team-2").setDescription("The second team");
const timeOption = new SlashCommandStringOption().setRequired(true).setName("time").setDescription("The time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Generates a schedule for that week.'),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id

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
        const teams = await db.get('SELECT roleid, code FROM Roles WHERE guild = ?', guild)
        for (const team of teams) {
            const roleExists = await interaction.guild.roles.fetch(team.roleid)
            if (roleExists && !(team.code === "FO" || team.code === "GM" || team.code === "HC")) {
                teamsArr.append(roleExists)
            }
        }

        shuffleArray(teamsArr)
        let byeWeekTeam;
        if (teamsArr.length % 2 === 1) {
            byeWeekTeam = teamsArr.pop()
        }

        let gameStr = ""

        while (teamsArr.length > 0) {
            gameStr += `${teamsArr.pop()} vs ${teamsArr.pop()}`
        }

        // then, construct the embed
        const embed = new EmbedBuilder()
                        .setTitle("Gametime scheduled!")
                        .setColor(team1.color)
                        .setDescription(`The ${team1} are going against the ${team2}!
                        \n>>> **Time:** ${time}\n**Referee:** None\n**Coach:** ${interaction.member} (${interaction.user.tag})`)
                        .setThumbnail(interaction.guild.iconURL())

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }

        const buttons = new ActionRowBuilder()

        const refButton = new ButtonBuilder()
                            .setCustomId('ref')
                            .setLabel('Referee')
                            .setStyle(ButtonStyle.Primary)

        const cancelButton = new ButtonBuilder()
                                .setCustomId('cancel')
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Danger)

        buttons.addComponents(refButton, cancelButton)


        const channel = await interaction.guild.channels.fetch(gametimeChannel.channelid)
        const filter = async i => {
            const db = await getDBConnection()
            const admin = await db.get('SELECT * from Admins WHERE discordid = ? AND guild = ?', [i.user.id, guild])
            const manager = await db.get('SELECT * from Managers WHERE discordid = ? AND guild = ?', [i.user.id, guild])
            return admin !== undefined || manager !== undefined || i.user.id === interaction.user.id
        }
        const message = await channel.send({ embeds:[embed], components:[buttons]})
        const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 7e8 });

        await interaction.editReply({ content:`Successfully posted gametime!`, ephemeral:true })

        // note that i represents the interaction here
        collector.on('collect', async i => {
            // only managers and admins can referee a game for now
            const db = await getDBConnection()
            const adminAuthorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
            const managerAuthorized = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
            await db.close()
            if (i.customId === "ref" && (adminAuthorized || managerAuthorized)) {
                embed.setDescription(`The ${team1} are going against the ${team2}!
                \n>>> **Time:** ${time}\n**Referee:** ${i.member} (${i.user.tag})\n**Coach:** ${interaction.member} (${interaction.user.tag})`)
                refButton.setDisabled(true);
                await i.update({ embeds:[embed], components:[buttons]})
            } else if (i.customId === "cancel") {
                await message.delete();
                collector.stop()
            }
        });

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
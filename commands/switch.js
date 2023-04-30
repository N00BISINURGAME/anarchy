const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandRoleOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require("../config.json")

const yourTeamOption = new SlashCommandRoleOption().setRequired(true).setName('team1').setDescription('The first team')

const otherTeamOption = new SlashCommandRoleOption().setRequired(true).setName('team2').setDescription('The second team')


module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch')
        .addRoleOption(yourTeamOption)
        .addRoleOption(otherTeamOption)
        .setDescription('Switches two teams around.'),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id

        const statsChannel = await db.get("SELECT channelid FROM Channels WHERE purpose = ? AND guild = ?", ["notices", guild]);
        if (!statsChannel) {
            await db.close()
            return interaction.editReply({ content:"A notices channel has not been set! You can set a channel for notices by running /channel.", ephemeral:true })
        }

        // first, get player stats
        const team1 = interaction.options.getRole("team1")
        const team2 = interaction.options.getRole("team2")

        const team1Temp = []

        for (const member of team1.members.values()) {
          await member.roles.remove(team1)
          team1Temp.push(member)
        }

        for (const member of team2.members.values()) {
          await member.roles.remove(team2)
          await member.roles.add(team1)
        }

        while (team1Temp.length > 0) {
          const member = await team1Temp.pop()
          await member.roels.add(team2)
        }

        const channel = await interaction.guild.channels.fetch(statsChannel.channelid)

        const embed = new EmbedBuilder()
          .setTitle("Teams switched!")
          .setDescription(`The ${team1} and ${team2} have switched rosters!
          \n>>> **Admin:** ${interaction.member} (${interaction.user.tag})`)
        
        if (interaction.guild.iconURL()) {
          embed.setThumbnail(interaction.guild.iconURL())
        }
        if (interaction.user.avatarURL()) {
          embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
          embed.setFooter({ text: `${interaction.user.tag}` })
        }

        await channel.send({ embeds:[embed] })

        await db.close()
        return interaction.editReply({ content:`Successfully posted stats!`, ephemeral:true })
    }
}
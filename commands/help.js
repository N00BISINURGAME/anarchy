const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {
    SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, SlashCommandRoleOption,
    ComponentType, ButtonStyle, ActionRowBuilder, ButtonBuilder
      } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers, maxPlayers } = require('../config.json');
const { commands } = require('./help.json')
 
const team1Option = new SlashCommandRoleOption().setRequired(true).setName("team-1").setDescription("The first team");
const team2Option = new SlashCommandRoleOption().setRequired(true).setName("team-2").setDescription("The second team");
const timeOption = new SlashCommandStringOption().setRequired(true).setName("time").setDescription("The time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gametime')
        .setDescription('Records a gametime.')
        .addRoleOption(team1Option)
        .addRoleOption(team2Option)
        .addStringOption(timeOption),
    async execute(interaction) {
        let helpStr;

        for (const command of commands) {
          let name = command.name
          let description = command.description
          helpStr += `**${name}** - ${description}\n`
        }
        // get teams and time
        const embed = new EmbedBuilder()
          .setTitle("Anarchy Commands")
          .setThumbnail(interaction.client.user.avatarURL())
          .setDescription(`${helpStr}`)
          .setColor([0, 0, 0])
        
        if (interaction.user.avatarURL()) {
          embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
          embed.setFooter({ text: `${interaction.user.tag}` })
        }

        await interaction.editReply({ embeds:[embed], ephemeral:true })
    }
}
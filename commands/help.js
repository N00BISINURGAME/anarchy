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
        .setName('help')
        .setDescription('Shows all commands for Anarchy.'),
    async execute(interaction) {
        let helpStr = "";

        let lower = 0
        let upper = 8

        for (let i = lower; i < upper && i < commands.length; i++) {
          let name = commands[i].name
          let description = commands[i].description
          helpStr += `**${name}** - ${description}\n\n`
        }
        // get teams and time
        const embed = new EmbedBuilder()
          .setTitle("Anarchy Commands")
          .setThumbnail(interaction.client.user.avatarURL())
          .setDescription(`${helpStr}`)
          .setColor([0, 0, 0])
        
        const buttons = new ActionRowBuilder()
          .addComponents(
              new ButtonBuilder()
                  .setCustomId('pagedown')
                  .setLabel('<')
                  .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                  .setCustomId('pageup')
                  .setLabel('>')
                  .setStyle(ButtonStyle.Primary)
          )
        
        if (interaction.user.avatarURL()) {
          embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
          embed.setFooter({ text: `${interaction.user.tag}` })
        }

        if (commands.length < upper) {
          return interaction.editReply({ embeds:[embed], ephemeral:true })
        }

      const message = await interaction.editReply({ embeds:[embed], components: [buttons], ephemeral:true })

      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

      collector.on('collect', async i => {
        if (commands.length < upper) return;
        lower = (i.customId === "pageup" ? (lower + 8 >= commands.length - 8 ? commands.length - 8 : lower + 8) : (lower - 8 <= 0 ? 0 : lower - 8))
        upper = (i.customId === "pageup" ? (upper + 8 >= commands.length ? commands.length : upper + 8) : (upper - 8 <= 8 ? 8 : upper - 8))
        helpStr = ""

        for (let i = lower; i < upper && i < commands.length; i++) {
            let name = commands[i].name
            let description = commands[i].description
            helpStr += `**${name}** - ${description}\n\n`
        }
        if (helpStr === "") helpStr = "There are no more commands!"
        
        embed.setDescription(`${helpStr}`)
        await i.update({ embeds:[embed], components: [buttons], ephemeral:true })
        await db.close()
    });
    }
}
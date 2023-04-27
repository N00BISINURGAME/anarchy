const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {
    SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder,
    ComponentType, ButtonStyle, ActionRowBuilder, ButtonBuilder
      } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const templates = require('./templates.json')

const templateChoices = new SlashCommandStringOption()
      .setRequired(true)
      .setName("template-choice")
      .setDescription("The choice of templates you want to view, between leagues and teamhubs.")
      .addChoices(
        { name:"League Templates", value:"leagues"},
        { name:"Teamhub Templates", value:"teamhubs"}
      )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('templates')
        .setDescription('Provides you with a list of templates.')
        .addStringOption(templateChoices),
    async execute(interaction) {
        const db = await getDBConnection();
        const user = interaction.user.id
        const guild = interaction.guild.id
        const choice = interaction.options.getString("template-choice")

        let templateStr = ""
        for (const template of templates[choice]) {
            templateStr += `${template}\n`
        }

        const embed = new EmbedBuilder()
            .setTitle('Existing templates for ' + choice)
            .setThumbnail(`${interaction.client.user.avatarURL()}`)
            .setDescription(`Anarchy currently has ${templates[choice].length} ${templates[choice].length === 1 ? "template" : "templates"}! To add more, DM Donovan#3771 sending him a template and he will add it! To preview templates, copy-paste the link into a chat and you can preview it by clicking the "view template" button.
            \nCredit to those who made the template, and particularly Lav#0002 and krem!#0736
            \n**Templates:**\n${templateStr}`)

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }

        await interaction.editReply({ embeds:[embed], ephemeral:true})

        await db.close()
    }
}
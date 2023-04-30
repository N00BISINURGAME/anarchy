const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandRoleOption } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require("../config.json")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addemojis')
        .setDescription('Adds all existing team logos as emojis'),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, interaction.guild.id])
        if (!authorized) {
            await db.close()
          return interaction.editReply({ content:"You are not authorized to change the team's logo!", ephemeral:true })
        }

        const existingEmojis = []

        const emojis = await interaction.guild.emojis.fetch()

        let count = 0
        let emojisAdded = ""
        const teams = await db.all('SELECT name, logo FROM Teams WHERE guild = ?', guild)
        // first, find existing emojis - check for all possible names using dashes, underscores, etc
        for (const team of teams) {
          for (const emoji of emojis.values()) {
            if (emoji.name.toLowerCase().includes(team.name.toLowerCase().replace(" ", "_"))) {
              existingEmojis.push(team)
              break;
            } else if (emoji.name.toLowerCase().includes(team.name.toLowerCase().replace(" ", "-"))) {
              existingEmojis.push(team)
              break;
            } else if (emoji.name.toLowerCase().includes(team.name.toLowerCase().replace(" ", ""))) {
              existingEmojis.push(team)
              break;
            }
          }
          // if it is not existing, add emoji to server
          if (!existingEmojis.includes(team)) {
            try {
              const newEmoji = await interaction.guild.emojis.create({ attachment:`${team.logo}`, name:`${team.name.replace(" ", "-")}`})
              emojisAdded += `${newEmoji}`
              count++
            } catch(err) {
              console.log(err)
            }
            
          }
        }

        await db.close()
        return interaction.editReply({ content:`${count} emojis were successfully added! They are displayed here:${emojisAdded}\nIf you do not see all emojis displayed, this likely means you have reached the maximum cap for emojis.`, ephemeral:true })
    }
}
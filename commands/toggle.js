const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const commandChoices = new SlashCommandStringOption().setName("command").setDescription("The command to toggle on and off").setRequired(true)
                          .addChoices(
                            { name:"Offers", value: "offers" },
                            { name:"Signings", value: "signings" },
                            { name:"Contract Offers", value: "contracts" }
                          )

const toggleChoices = new SlashCommandIntegerOption().setName("state").setDescription("Whether you want the command on or off").setRequired(true)
                          .addChoices(
                            { name:"On", value: 1 },
                            { name:"Off", value: 0 }
                          )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toggle')
        .addStringOption(commandChoices)
        .addIntegerOption(toggleChoices)
        .setDescription('Allows you to toggle offers and signings on and off.'),
    async execute(interaction) {
        const db = await getDBConnection();
        const userChoice = interaction.options.getString("command")
        const state = interaction.options.getInteger("state")
        const guild = interaction.guild.id

        const user = interaction.user.id;
          const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
          if (!authorized) {
              await db.close();
              return interaction.editReply({ content:"You are not authorized to toggle commands!", ephemeral:true });
          }

        await db.run(`UPDATE Leagues SET ${userChoice} = ? WHERE guild = ?`, [state, guild])
        await db.close()
        return interaction.editReply({content:`Successfully toggled ${userChoice} ${state === 1 ? "on" : "off"}!`})
    }
}
const { SlashCommandBuilder, SlashCommandChannelOption, SlashCommandStringOption, ChannelType } = require('discord.js');
const { serif, script, sansSerif } = require('weird-fonts')

const textOption = new SlashCommandStringOption().setName("text").setDescription("The text to boldify").setRequired(true)

const typeChoices = new SlashCommandStringOption().setName("type").setDescription("The typeface you want to use").setRequired(true)
                          .addChoices(
                            { name:"𝗦𝗮𝗻𝘀 𝗦𝗲𝗿𝗶𝗳 𝗕𝗼𝗹𝗱", value: "1" },
                            { name:"𝙎𝙖𝙣𝙨 𝙎𝙚𝙧𝙞𝙛 𝘽𝙤𝙡𝙙", value: "2" },
                            { name:"𝓢𝓪𝓷𝓼 𝓢𝓮𝓻𝓲𝓯 𝓑𝓸𝓵𝓭", value: "3" },
                            { name:"𝐁𝐨𝐥𝐝", value:"4" },
                            { name:"𝑩𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄", value:"5" }
                          )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bold')
        .addStringOption(textOption)
        .addStringOption(typeChoices)
        .setDescription('Allows you to generate custom bold text from a series of options'),
    async execute(interaction) {
      const text = interaction.options.getString('text')
      const type = interaction.options.getString('type')
      let str
      if (type === "1") {
        str = sansSerif(`${text}`, { fontStyle:"bold" })
      } else if (type === "2") {
        str = sansSerif(`${text}`, { fontStyle:"bold-italic" })
      } else if (type === "3") {
        str = script(`${text}`, { fontStyle:"bold" })
      } else if (type === "4") {
        str = serif(`${text}`, { fontStyle:"bold" })
      } else if (type === "5") {
        str = serif(`${text}`, { fontStyle:"bold-italic" })
      }

      return interaction.editReply({ content:`${str}`, ephemeral:true})
    }
}
const { SlashCommandBuilder, SlashCommandChannelOption, SlashCommandStringOption, ChannelType } = require('discord.js');
const { transform, getFonts } = require('convert-unicode-fonts')

const textOption = new SlashCommandStringOption().setName("text").setDescription("The text to boldify").setRequired(true)

const typeChoices = new SlashCommandStringOption().setName("type").setDescription("The typeface you want to use").setRequired(true)
                          .addChoices(
                            { name:"𝗦𝗮𝗻𝘀 𝗦𝗲𝗿𝗶𝗳 𝗕𝗼𝗹𝗱", value: "sansSerifBold" },
                            { name:"𝙎𝙖𝙣𝙨 𝙎𝙚𝙧𝙞𝙛 𝘽𝙤𝙡𝙙", value: "sansSerifBoldItalic" },
                            { name:"𝓢𝓪𝓷𝓼 𝓢𝓮𝓻𝓲𝓯 𝓑𝓸𝓵𝓭", value: "scriptBold" },
                            { name:"𝐁𝐨𝐥𝐝", value:"bold" }
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
      const fonts = getFonts()
      const str = transform(`${text}`, fonts[type])

      return interaction.editReply({ content:`${str}`, ephemeral:true})
    }
}
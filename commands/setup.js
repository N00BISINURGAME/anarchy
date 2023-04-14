const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelSelectMenuBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { teams } = require('./teams.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Runs the server setup prompts.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id;
        const embed = new EmbedBuilder()
            .setTitle("Thank you for choosing Anarchy!")
            .setDescription(`You will now run through the server setup. To move on to the next step of the server setup, press the green button marked "next". Note that you will have 2 minutes per step.`)

        const buttons = new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Continue')
                            .setStyle(ButtonStyle.Success))

        const transactionMenu = new ChannelSelectMenuBuilder()
            .setCustomId("transactionchannel")
            .setPlaceholder("Select a transaction channel")
        const transactionRow = new ActionRowBuilder().addComponents(transactionMenu)

        const demandsMenu = new ChannelSelectMenuBuilder()
            .setCustomId("demandschannel")
            .setPlaceholder("Select a demands channel")
        const demandsRow = new ActionRowBuilder().addComponents(demandsMenu)

        const resultsMenu = new ChannelSelectMenuBuilder()
            .setCustomId("resultschannel")
            .setPlaceholder("Select a game results channel")
        const resultsRow = new ActionRowBuilder().addComponents(resultsMenu)

        let message = await interaction.editReply({ embeds:[embed], components:[buttons], ephemeral:true})
        let messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 120000})

        if (messageCollector.customId === "next") {
            embed.setDescription("You will now be prompted to select your channels for transactions (signings, releases, promotions, etc). Note that you can change these channels at any time by running the /channel command.")
            // only prompt for 3 channels; transactions, demands, results
            message = await messageCollector.update({ embeds:[embed], components:[transactionRow], ephemeral:true})
            messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        }
        console.log(messageCollector.values[0])
        embed.setDescription("You will now be prompted to select your options for importing teams or starting from scratch. Note that you can create new teams at any time by running the /newteam command.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[buttons], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 120000})

        await db.close()
    }
}
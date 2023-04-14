const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
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

        const addTeamMenu = new StringSelectMenuBuilder()
            .setCustomId("addteams")
            .setPlaceholder("Select an option")
            .addOptions(
                {
                    label:"Yes, scan for existing NFL teams but don't add anymore",
                    value:"1"
                },
                {
                    label:"Yes, scan for existing NFL teams and add NFL teams that don't exist",
                    value:"2"
                },
                {
                    label:"No, I will use /newteam to add them all myself",
                    value:"3"
                }
            )
        const addTeamRow = new ActionRowBuilder().addComponents(addTeamMenu)

        let message = await interaction.editReply({ embeds:[embed], components:[buttons], ephemeral:true})
        let messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 120000})

        // prompt the user for the transaction channel
        embed.setDescription("You will now be prompted to select your channels for transactions (signings, releases, promotions, etc). Note that you can change these channels at any time by running the /channel command.")
        message = await messageCollector.update({ embeds:[embed], components:[transactionRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const transactionChannelId = messageCollector.values[0]
        
        console.log(transactionChannelId)

        embed.setDescription("You will now be prompted to select your channels for demand notifications. Note that you can change these channels at any time by running the /channel command.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[demandsRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const demandChannelId = messageCollector.values[0]

        console.log(demandChannelId)

        embed.setDescription("You will now be prompted to select your channels for game result notifications. Note that you can change these channels at any time by running the /channel command.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[demandsRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const resultsChannelId = messageCollector.values[0]

        console.log(resultsChannelId)

        embed.setDescription("You will now be prompted to select how you want to add teams. Note that you can change this at anytime by running /setup again.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[addTeamRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const teamOption = messageCollector.values[0]

        console.log(teamOption)

        embed.setDescription("You are done with setup! If you want to add a gametime and LFP channel, run /channel. Good luck with your league!")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[], ephemeral:true})

        await db.close()
    }
}
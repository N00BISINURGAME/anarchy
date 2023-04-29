const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandChannelOption, SlashCommandStringOption, EmbedBuilder, ChannelType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const channelChoices = new SlashCommandStringOption().setName("channel-options").setDescription("The possible types of channels").setRequired(true)
                          .addChoices(
                            { name:"Transactions", value: "transactions" },
                            { name:"Game Results", value: "results" },
                            { name:"Demands", value: "demands" },
                            { name:"Gametimes", value:"gametime" },
                            { name:"Looking for Players", value:"lfp" },
                            { name:"Notices", value:"notices" },
                            { name:"Pickups & QBB's", value:"pickups-qbbs" },
                            { name:"Game Schedules", value:"schedules" },
                            { name:"Game Stats", value:"stats" }
                          )

const channelMention = new SlashCommandChannelOption().setName("channel").setDescription("The channel you want to set").setRequired(true).addChannelTypes(ChannelType.GuildText)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channel')
        .addChannelOption(channelMention)
        .addStringOption(channelChoices)
        .setDescription('Allows you to set a channel for a specific purpose'),
    async execute(interaction) {
        const db = await getDBConnection();
        const userChoice = interaction.options.getString("channel-options")
        const channel = interaction.options.getChannel("channel")
        const guild = interaction.guild.id

        const user = interaction.user.id;
        const authorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        if (!authorized) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to switch channels!", ephemeral:true });
        }

        // check if the channel exists
        const channelExists = await db.get('SELECT * FROM Channels WHERE purpose = ? AND guild = ?', userChoice, guild)
        if (channelExists) {
            await db.run('UPDATE Channels SET channelid = ? WHERE purpose = ? AND guild = ?', [channel.id, userChoice, guild])
        } else {
            await db.run('INSERT INTO Channels(guild, channelid, purpose) VALUES (?, ?, ?)', [guild, channel.id, userChoice])
        }
        await db.close()
        return interaction.editReply({content:`Successfully linked ${channel} for ${userChoice}!`})
    }
}
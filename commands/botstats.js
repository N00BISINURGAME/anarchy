const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('Gives some information about the bot.'),
    async execute(interaction) {
        const db = await getDBConnection();

        const uniqueUsers = await db.get('SELECT COUNT(DISTINCT discordid) AS users FROM Players')

        const uniqueGuilds = interaction.client.guilds.cache.size

        const uptime = msToTime(interaction.client.uptime)

        const embed = new EmbedBuilder()
            .setTitle("Bot statistics for Anarchy")
            .setThumbnail(`${interaction.client.user.displayAvatarURL()}`)
            .setFields(
                {name:"Bot Creator", value:"Donovan#3771"},
                {name:"Number of unique users", value:`${uniqueUsers.users}`},
                {name:"Number of leagues using Anarchy", value:`${uniqueGuilds}`},
                {name:"Current uptime", value:`${uptime}`}
            )

        await interaction.editReply({ embeds:[embed], ephemeral:true })
        await db.close();
    }
}

function msToTime(ms) {
    let seconds = (ms / 1000).toFixed(1);
    let minutes = (ms / (1000 * 60)).toFixed(1);
    let hours = (ms / (1000 * 60 * 60)).toFixed(1);
    let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
    if (seconds < 60) return seconds + " Sec";
    else if (minutes < 60) return minutes + " Min";
    else if (hours < 24) return hours + " Hrs";
    else return days + " Days"
}
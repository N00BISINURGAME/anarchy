const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const roleOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName('position')
    .setDescription('The position to see the statsheet for.')
    .addChoices(
        {name:"Quarterback", value:"Quarterbacks"},
        {name:"Wide Receiver", value:"Wide Receivers"},
        {name:"Runningback", value:"Runningbacks"},
        {name:"Defense", value:"Defenders"},
        {name:"Kicker", value:"Kickers"},
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getstats')
        .setDescription('Gets the stats of all players in a particular position.')
        .addStringOption(roleOption),
    async execute(interaction) {
        // needs to be implemented
        const db = await getDBConnection();
        const user = interaction.user.id
        const guild = interaction.guild.id
        const position = interaction.options.getString("position")

        let str = ""
        let stats
        const embed = new EmbedBuilder()
                .setTitle(`${position} statsheet for ${interaction.guild.name}!`)
                .setColor([0, 0, 0])

        if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }

        if (position === "Quarterbacks") {
            stats = await db.all('SELECT * FROM QBStats WHERE guild = ? ORDER BY passer_rating', guild)
        } else if (position === "Wide Receivers") {
            stats = await db.all('SELECT * FROM WRStats WHERE guild = ? ORDER BY average', guild)
        } else if (position === "Runningbacks") {
            stats = await db.all('SELECT * FROM RBStats WHERE guild = ? ORDER BY average', guild)
        } else if (position === "Defenders") {
            stats = await db.all('SELECT * FROM DefenseStats WHERE guild = ? ORDER BY rank', guild)
        } else if (position === "Kickers") {
            stats = await db.all('SELECT *, (good_kicks / attempts) AS average FROM KStats WHERE guild = ? ORDER BY average', guild)
        }

        for (let i = 0; i < 10 && i < stats.length; i++) {
            // str += `**${i + 1})** ${user} \`${user.user.tag}\` - `
            const user = await interaction.guild.members.fetch(stats[i].discordid)
            if (position === "Quarterbacks") {
                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].passer_rating} passer rating, ${stats[i].yards} yards, ${Math.round((stats[i].completions / stats[i].attempts) * 1000) / 10} completion percentage (${stats[i].completions}/${stats[i].attempts})\n\n`
            } else if (position === "Wide Receivers") {
                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].average} yards per catch, ${stats[i].catches} catches, ${stats[i].yards} yards, ${stats[i].touchdowns} touchdowns\n\n`
            } else if (position === "Runningbacks") {
                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].average} yards per attempt, ${stats[i].attempts} attempts, ${stats[i].yards} yards, ${stats[i].touchdowns} touchdowns\n\n`
            } else if (position === "Defenders") {
                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].tackles} tackles, ${stats[i].interceptions} interceptions, ${stats[i].touchdowns} touchdowns, ${stats[i].sacks} sacks, ${stats[i].safeties} safeties, ${stats[i].fumble_recoveries} fumble recoveries\n\n`
            } else if (position === "Kickers") {
                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].average} kicking percentage (${stats[i].good_kicks}/${stats[i].attempts})`
            }
        }

        if (str === "") str = "No stats logged for players in this category!"

        embed.setDescription(`${str}`)

        await interaction.editReply({ embeds:[embed] })
        await db.close();
        
    }
}
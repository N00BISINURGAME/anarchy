const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, ComponentType, SlashCommandStringOption, SlashCommandIntegerOption, ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
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

const seasonOption = new SlashCommandIntegerOption()
    .setName("season")
    .setDescription("The season that you want to get stats from")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('statsheet')
        .setDescription('Gets the stats of all players in a particular position.')
        .addStringOption(roleOption)
        .addIntegerOption(seasonOption),
    async execute(interaction) {
        // needs to be implemented
        const db = await getDBConnection();
        const user = interaction.user.id
        const guild = interaction.guild.id
        const position = interaction.options.getString("position")
        let season = interaction.options.getInteger("season")
        if (!season) {
            const seasonSql = await db.get('SELECT season FROM Leagues WHERE guild = ?', guild)
            season = seasonSql.season
        }

        let lower = 0;
        let upper = 10;
        let str = ""
        let stats
        const embed = new EmbedBuilder()
                .setTitle(`${position} statsheet for ${interaction.guild.name}!`)
                .setColor([0, 0, 0])

        const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pagedown')
                        .setLabel('<')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('pageup')
                        .setLabel('>')
                        .setStyle(ButtonStyle.Primary)
                )

        if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }

        if (position === "Quarterbacks") {
            stats = await db.all('SELECT * FROM QBStats WHERE guild = ? AND season = ? ORDER BY passer_rating DESC', [guild, season])
        } else if (position === "Wide Receivers") {
            stats = await db.all('SELECT * FROM WRStats WHERE guild = ? AND season = ? ORDER BY average DESC', [guild, season])
        } else if (position === "Runningbacks") {
            stats = await db.all('SELECT * FROM RBStats WHERE guild = ? AND season = ? ORDER BY average DESC', [guild, season])
        } else if (position === "Defenders") {
            stats = await db.all('SELECT * FROM DefenseStats WHERE guild = ? AND season = ? ORDER BY rank DESC', [guild, season])
        } else if (position === "Kickers") {
            stats = await db.all('SELECT *, (good_kicks / attempts) AS average FROM KStats WHERE guild = ? AND season = ? ORDER BY average DESC', [guild, season])
        }

        for (let i = lower; i < upper && i < stats.length; i++) {
            // str += `**${i + 1})** ${user} \`${user.user.tag}\` - `
            const user = await interaction.guild.members.fetch(stats[i].discordid)
            if (position === "Quarterbacks") {
                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].passer_rating} passer rating, ${stats[i].yards} yards, ${Math.round((stats[i].completions / stats[i].attempts) * 1000) / 10}% completion percentage (${stats[i].completions}/${stats[i].attempts})\n\n`
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

        if (stats.length < upper) {
            await db.close()
            return interaction.editReply({ embeds:[embed], ephemeral:true })
        }
        

        const message = await interaction.editReply({ embeds:[embed], components:[buttons], ephemeral:true })
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            const db = await getDBConnection();
            lower = (i.customId === "pageup" ? (lower + 10 >= stats.length - 10 ? stats.length - 10 : lower + 10) : (lower - 10 <= 0 ? 0 : lower - 10))
            upper = (i.customId === "pageup" ? (upper + 10 >= stats.length ? stats.length : upper + 10) : (upper - 10 <= 10 ? 10 : upper - 10))
            str = ""

            for (let i = lower; i < upper && i < stats.length; i++) {
                // str += `**${i + 1})** ${user} \`${user.user.tag}\` - `
                let user
                try {
                    user = await interaction.guild.members.fetch(stats[i].discordid)
                } catch(err) {
                    console.log(err)
                    continue
                }
                
                if (position === "Quarterbacks") {
                    str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].passer_rating} passer rating, ${stats[i].yards} yards, ${Math.round((stats[i].completions / stats[i].attempts) * 1000) / 10}% completion percentage (${stats[i].completions}/${stats[i].attempts})\n\n`
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
            if (str === "") str = "No more stats logged for players in this category!"
            embed.setDescription(`${str}`)
            await i.update({ embeds:[embed], components: [buttons], ephemeral:true })
            await db.close()
        });
        await db.close();
        
    }
}
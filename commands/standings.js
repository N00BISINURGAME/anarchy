const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, ComponentType, ButtonStyle, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('standings')
        .setDescription('Displays league standings'),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id

        // get information on league standings, sorted by wins, then sorted by point differential
        const teamStandings = await db.all('SELECT code, name, wins, losses, ties, ptdifferential FROM Teams ORDER BY wins DESC, ties DESC, ptdifferential DESC, name ASC WHERE guild = ?', guild)

        const embed = new EmbedBuilder()
            .setTitle(`League Standings for season ${season}`)

        if (teamStandings.length > 0) {
            embed.setDescription(`The ${teamStandings[0].name} are the top-ranked team in the league!`)
        }

        let page = 1;
        let lower = 0;
        let upper = 8;
        let standingsString = ""
        for (let i = lower; i < upper; i++) {
            const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [teamStandings[i].code, guild])
            standingsString += `**${i + 1})** <@&${roleId.roleid}> ${teamStandings[i].wins}-${teamStandings[i].losses}-${teamStandings[i].ties}, ${teamStandings[i].ptdifferential} point differential\n\n`
        }
        if (standingsString === "") standingsString = "There are no teams in this league!"

        embed.addFields({name:"Standings", value:standingsString})
        embed.setFooter({ text:`Page ${page} / ${Math.floor((teamStandings.length / 8))}` })
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

        const message = await interaction.editReply({ embeds:[embed], components: [buttons], ephemeral:true })

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            const db = await getDBConnection();
            console.log(page + 1)
            console.log(Math.floor((teamStandings.length / 8)))
            page = (i.customId === "pageup" ? (page + 1 >= Math.floor((teamStandings.length / 8)) ? Math.floor((teamStandings.length / 8)) : page + 1) : (page - 1 <= 1 ? 1 : page - 1))
            lower = (i.customId === "pageup" ? (lower + 8 >= teamStandings.length - 8 ? teamStandings.length - 8 : lower + 8) : (lower - 8 <= 0 ? 0 : lower - 8))
            upper = (i.customId === "pageup" ? (upper + 8 >= teamStandings.length ? teamStandings.length : upper + 8) : (upper - 8 <= 8 ? 8 : upper - 8))
            standingsString = ""

            for (let i = lower; i < upper; i++) {
                const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [teamStandings[i].code, guild])
                standingsString += `**${i + 1})** <@&${roleId.roleid}> ${teamStandings[i].wins}-${teamStandings[i].losses}-${teamStandings[i].ties}, ${teamStandings[i].ptdifferential} point differential\n\n`
            }
            if (standingsString === "") standingsString = "There are no teams in this league!"
            
            embed.setFields({name:"Standings", value:standingsString})
            embed.setFooter({ text:`Page ${page} / ${Math.floor((teamStandings.length / 8))}` })
            await i.update({ embeds:[embed], components: [buttons], ephemeral:true })
            await db.close()
        });

        await db.close();

    }
}
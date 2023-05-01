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

        if (position === "Quarterbacks") {
            stats = await db.all('SELECT * FROM QBStats WHERE guild = ? ORDER BY passer_rating', guild)
            console.log(stats)

            for (let i = 0; i < stats.length && i < 10; i++) {
                const user = await interaction.guild.members.fetch(stats[i].discordid)

                str += `**${i + 1})** ${user} \`${user.user.tag}\` - ${stats[i].passer_rating} passer rating, ${stats[i].yards} yards, ${stats[i].touchdowns} touchdowns, ${Math.round((stats[i].completions / stats[i].attempts) * 10) / 10}% completion percentage (${stats[i].completions} / ${stats[i].attempts})\n\n`
            }

            const embed = new EmbedBuilder()
                .setTitle(`${position} statsheet for ${interaction.guild.name}!`)
                .setColor([0, 0, 0])
                .setDescription(`${str}`)
            
            if (interaction.guild.iconURL()) {
                embed.setThumbnail(interaction.guild.iconURL())
            }
    
            if (interaction.user.avatarURL()) {
                embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
            } else {
                embed.setFooter({ text: `${interaction.user.tag}` })
            }
            await db.close()
            return interaction.editReply({ embeds:[embed], ephemeral:true })
        }

        await interaction.editReply("Not implemented yet!")
        await db.close();
        
    }
}
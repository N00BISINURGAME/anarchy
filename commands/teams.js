const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to get all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Shows all existing teams with their member counts'),
    async execute(interaction) {
        const db = await getDBConnection();
        
        // first, get all teams
        const teams = await db.all('SELECT playercount, code FROM Teams ORDER BY playercount DESC')

        let page = 1;
        let lower = 0;
        let upper = 8;
        let teamStr = ""
        for (let i = lower; i < upper; i++) {
            const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ?', teams[i].code);
            const fo = await db.get('SELECT discordid FROM Players WHERE role = "FO" AND team = ?', teams[i].code)
            const foStr = fo ? `<@${fo.discordid}>` : "Vacant"
            const role = await interaction.guild.roles.fetch(roleId.roleid);
            teamStr += `${role} - ${teams[i].playercount} members\nFranchise Owner:${foStr}\n\n`
        }

        if (teamStr === "") teamStr = "None";

        const embed = new EmbedBuilder()
            .setTitle(`Existing teams`)
            .addFields(
                {name:"Teams", value:teamStr}
            )

        embed.setFooter({ text:`Page ${page} / ${Math.floor((teams.length / 8))}` })
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
            page = (i.customId === "pageup" ? (page + 1 >= Math.floor((teams.length / 8)) ? Math.floor((teams.length / 8)) : page + 1) : (page - 1 <= 1 ? 1 : page - 1))
            lower = (i.customId === "pageup" ? (lower + 8 >= teams.length - 8 ? teams.length - 8 : lower + 8) : (lower - 8 <= 0 ? 0 : lower - 8))
            upper = (i.customId === "pageup" ? (upper + 8 >= teams.length ? teams.length : upper + 8) : (upper - 8 <= 8 ? 8 : upper - 8))
            teamStr = ""

            for (let i = lower; i < upper; i++) {
                const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ?', teams[i].code);
                const fo = await db.get('SELECT discordid FROM Players WHERE role = "FO" AND team = ?', teams[i].code)
                const foStr = fo ? `<@${fo.discordid}>` : "Vacant"
                teamStr += `<@&${roleId.roleid}> - ${teams[i].playercount} members\nFranchise Owner:${foStr}\n\n`
            }
            if (teamStr === "") teamStr = "None"
            
            embed.setFields({name:"Teams", value:teamStr})
            embed.setFooter({ text:`Page ${page} / ${Math.floor((teams.length / 8))}` })
            await i.update({ embeds:[embed], components: [buttons], ephemeral:true })
            await db.close()
        });

        console.log("done!");

        await db.close();

    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to get all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teams')
        .setDescription('Shows all existing teams with their member counts'),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id
        // first, get all teams
        const teams = await db.all('SELECT code FROM Teams WHERE guild = ?', guild)
        const foRole = await db.get('SELECT roleid FROM Roles WHERE code = "FO" AND guild = ?', guild)

        let page = 1;
        let lower = 0;
        let upper = 8;
        let teamStr = ""
        for (let i = lower; i < upper && i < teams.length; i++) {
            const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [teams[i].code, guild]);
            const teamRole = await interaction.guild.roles.fetch(roleId.roleid)
            let foStr = "Vacant";
            for (const member of teamRole.members.values()) {
                if (member.roles.cache.get(foRole.roleid)) {
                    foStr = `${member} (${member.user.tag})`
                    break
                }
            }
            const role = await interaction.guild.roles.fetch(roleId.roleid);
            teamStr += `${role} - ${teamRole.members.size} members\nFranchise Owner:${foStr}\n\n`
        }

        if (teamStr === "") teamStr = "None";

        const embed = new EmbedBuilder()
            .setTitle(`Existing teams`)
            .addFields(
                {name:"Teams", value:teamStr}
            )
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

        if (teams.length < upper) {
            console.log(teams.length)
            return interaction.editReply({ embeds:[embed], ephemeral:true })
        }

        const message = await interaction.editReply({ embeds:[embed], components: [buttons], ephemeral:true })

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            const db = await getDBConnection();
            page = (i.customId === "pageup" ? (page + 1 >= Math.floor((teams.length / 8)) ? Math.floor((teams.length / 8)) : page + 1) : (page - 1 <= 1 ? 1 : page - 1))
            lower = (i.customId === "pageup" ? (lower + 8 >= teams.length - 8 ? teams.length - 8 : lower + 8) : (lower - 8 <= 0 ? 0 : lower - 8))
            upper = (i.customId === "pageup" ? (upper + 8 >= teams.length ? teams.length : upper + 8) : (upper - 8 <= 8 ? 8 : upper - 8))
            teamStr = ""

            for (let i = lower; i < upper && i < teams.length; i++) {
                const roleId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [teams[i].code, guild]);
                const teamRole = await interaction.guild.roles.fetch(roleId.roleid)
                let foStr = "Vacant";
                for (const member of teamRole.members.values()) {
                    if (member.roles.cache.get(foRole.roleid)) {
                        foStr = member
                        break
                    }
                }
                const role = await interaction.guild.roles.fetch(roleId.roleid);
                teamStr += `${role} - ${teamRole.members.size} members\nFranchise Owner:${foStr}\n\n`
            }
            if (teamStr === "") teamStr = "None"
            embed.setFields({name:"Teams", value:teamStr})
            await i.update({ embeds:[embed], components: [buttons], ephemeral:true })
            await db.close()
        });

        console.log("done!");

        await db.close();

    }
}
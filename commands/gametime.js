const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {
    SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, SlashCommandRoleOption,
    ComponentType, ButtonStyle, ActionRowBuilder, ButtonBuilder
      } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers, maxPlayers } = require('../config.json');

const team1Option = new SlashCommandRoleOption().setRequired(true).setName("team-1").setDescription("The first team");
const team2Option = new SlashCommandRoleOption().setRequired(true).setName("team-2").setDescription("The second team");
const timeOption = new SlashCommandStringOption().setRequired(true).setName("time").setDescription("The time");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gametime')
        .setDescription('Records a gametime.')
        .addRoleOption(team1Option)
        .addRoleOption(team2Option)
        .addStringOption(timeOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // get teams and time
        const team1 = interaction.options.getRole("team-1");
        const team2 = interaction.options.getRole("team-2");
        const time = interaction.options.getString("time");
        const guild = interaction.guild.id

        // then, check if gametime is enabled
        const gametimeChannel = await db.get("SELECT channelid FROM Channels WHERE purpose = ? AND guild = ?", ["gametime", guild]);
        if (!gametimeChannel) {
            return interaction.editReply({ content:"Gametimes are currently disabled!", ephemeral:true })
        }

        // then, check if a valid user ran the command
        const foRole = await db.get('SELECT * FROM Roles WHERE code = "FO" AND guild = ?', [guild])
        const gmRole = await db.get('SELECT * FROM Roles WHERE code = "GM" AND guild = ?', [guild])
        const admin = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        const manager = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
        if (!(interaction.member.roles.cache.get(foRole.roleid) || interaction.member.roles.cache.get(gmRole.roleid) || admin || manager)) {
            return interaction.editReply({ content:"You are not permitted to run this command!", ephemeral:true })
        }

        // then, check edge cases (same team for team1 and team2, invalid teams being pinged)
        // worry about second case tmrw
        if (team1 === team2) {
            return interaction.editReply({ content:"Ensure both teams are unique!", ephemeral:true })
        }

        // then, construct the embed
        const embed = new EmbedBuilder()
                        .setTitle("Gametime scheduled!")
                        .setColor(team1.color)
                        .setDescription(`The ${team1} are going against the ${team2}!
                        \n>>> **Time:** ${time}\n**Referee:** None\n**Coach:** ${interaction.member} (${interaction.user.tag})`)
                        .setThumbnail(interaction.guild.iconURL())
                        
        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }

        const buttons = new ActionRowBuilder()

        const refButton = new ButtonBuilder()
                            .setCustomId('ref')
                            .setLabel('Referee')
                            .setStyle(ButtonStyle.Primary)

        const cancelButton = new ButtonBuilder()
                                .setCustomId('cancel')
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Danger)

        buttons.addComponents(refButton, cancelButton)


        const channel = await interaction.guild.channels.fetch(gametimeChannel.channelid)
        const filter = async i => {
            const db = await getDBConnection()
            const admin = await db.get('SELECT * from Admins WHERE discordid = ? AND guild = ?', [i.user.id, guild])
            const manager = await db.get('SELECT * from Managers WHERE discordid = ? AND guild = ?', [i.user.id, guild])
            return admin !== undefined || manager !== undefined || i.user.id === interaction.user.id
        }
        const message = await channel.send({ embeds:[embed], components:[buttons]})
        const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 7e8 });

        await interaction.editReply({ content:`Successfully posted gametime!`, ephemeral:true })

        // note that i represents the interaction here
        collector.on('collect', async i => {
            // only managers and admins can referee a game for now
            const db = await getDBConnection()
            const adminAuthorized = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
            const managerAuthorized = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [interaction.user.id, guild])
            await db.close()
            if (i.customId === "ref" && (adminAuthorized || managerAuthorized)) {
                embed.setDescription(`The ${team1} are going against the ${team2}!
                \n>>> **Time:** ${time}\n**Referee:** ${i.member} (${i.user.tag})\n**Coach:** ${interaction.member} (${interaction.user.tag})`)
                refButton.setDisabled(true);
                await i.update({ embeds:[embed], components:[buttons]})
            } else if (i.customId === "cancel") {
                await message.delete();
                collector.stop()
            }
        });

        await db.close()
    }
}
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
        const validUser = await db.get('SELECT * FROM Players WHERE role = "FO" OR role = "GM" AND discordid = ? AND guild = ?', [interaction.user.id, guild])
        if (!admins.includes(interaction.user.id) && !managers.includes(interaction.user.id) && !validUser) {
            return interaction.editReply({ content:"You are not permitted to run this command!", ephemeral:true })
        }

        // then, check edge cases (same team for team1 and team2, invalid teams being pinged)
        // worry about second case tmrw
        if (team1 === team2) {
            return interaction.editReply({ content:"Ensure both teams are unique!", ephemeral:true })
        }

        // then, construct the embed
        const embed = new EmbedBuilder()
                        .setTitle("Gametime!")
                        .setDescription(`${team1} vs ${team2} @ ${time}`)
                        .setThumbnail(interaction.guild.iconURL())
                        .setFields({
                            name:"Referee", value:"None!"
                        })
                        .setFooter({text:`Gametime posted by ${interaction.user.tag}`})

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
        const filter = i => admins.includes(i.user.id) || managers.includes(i.user.id) || i.user.id === interaction.user.id
        const message = await channel.send({ embeds:[embed], components:[buttons]})
        const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 7e8 });

        await interaction.editReply({ content:`Successfully posted gametime!`, ephemeral:true })

        // note that i represents the interaction here
        collector.on('collect', async i => {
            // only managers and admins can referee a game for now
            if (i.customId === "ref" && (admins.includes(i.user.id) || managers.includes(i.user.id))) {
                embed.setFields({
                    name:"Referee", value:`${i.user}`
                })
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
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { channel } = require('diagnostics_channel');

const memberOption = new SlashCommandUserOption()
                                .setRequired(true)
                                .setName('player')
                                .setDescription('The player to suspend.')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unsuspend')
        .addUserOption(memberOption)
        .setDescription('Unsuspends a player.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id

        const suspendedUser = interaction.options.getMember("player")
        if (!suspendedUser) {
            await db.close()
            return interaction.editReply({ content:"This user may have left the server! Confirm that they are still in the server and run this command again.", ephemeral:true });
        }
        const reason = interaction.options.getString("reason")
        const duration = interaction.options.getString("duration")

        const admin = await db.run('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        const manager = await db.run('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user, guild])
        if (!(admin || manager)) {
            await db.close();
            return interaction.editReply({content:"You are not authorized to unsuspend players!", ephemeral:true});
        }

        // get the channel
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
        if (!channelId) {
            await db.close();
            return interaction.editReply({content:`A notices channel has not been set! This can be set by running /channel.`, ephemeral:true});
        }

        // then, add them to the database
        const alreadySuspended = await db.get('SELECT * FROM Suspensions WHERE discordid = ? AND guild = ?', [suspendedUser.id, guild])
        if (!alreadySuspended) {
            await db.close();
            return interaction.editReply({content:`${suspendedUser} is not currently suspended!`, ephemeral:true});
        }

        await db.run('DELETE FROM Suspensions WHERE discordid = ? AND guild = ?', [suspendedUser.id, guild])

        // then, make the embed
        const embed = new EmbedBuilder()
            .setTitle("Player unsuspended!")
            .setColor([0, 255, 0])
            .setDescription(`${suspendedUser} \`${suspendedUser.user.tag}\` has been unsuspended from the league! They were previously suspended for **${alreadySuspended.duration}** due to **${alreadySuspended.reason}**!
            \n>>> **Admin:** ${interaction.member} \`${interaction.user.tag}\``)

        if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        if (interaction.user.avatarURL()) {
            embed.setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
        } else {
            embed.setFooter({ text: `${interaction.user.tag}` })
        }

        const channel = await interaction.guild.channels.fetch(channelId.channelid)

        await channel.send({ embeds:[embed] })

        await db.close();

        return interaction.editReply({ content:`${suspendedUser} has been successfully unsuspended!`, ephemeral:true});
    }
}
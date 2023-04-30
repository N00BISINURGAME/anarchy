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

const reasonOption = new SlashCommandStringOption()
                                .setRequired(true)
                                .setName('reason')
                                .setDescription('The reason for suspending the player.')

const durationOption = new SlashCommandStringOption()
                                .setRequired(true)
                                .setName('duration')
                                .setDescription('The duration the player is suspended for.')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suspend')
        .addUserOption(memberOption)
        .addStringOption(reasonOption)
        .addStringOption(durationOption)
        .setDescription('Sets the maximum player count per team to a specified value.'),
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
            return interaction.editReply({content:"You are not authorized to suspend players!", ephemeral:true});
        }

        // get the channel
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
        if (!channelId) {
            await db.close();
            return interaction.editReply({content:`A notices channel has not been set! This can be set by running /channel.`, ephemeral:true});
        }

        // then, add them to the database
        const alreadySuspended = await db.get('SELECT * FROM Suspensions WHERE discordid = ? AND guild = ?', [suspendedUser.id, guild])
        if (alreadySuspended) {
            await db.close();
            return interaction.editReply({content:`${suspendedUser} is already suspended!`, ephemeral:true});
        }

        await db.run('INSERT INTO Suspensions(discordid, guild, reason, duration) VALUES (?, ?, ?, ?)', [suspendedUser.id, guild, reason, duration])

        // then, make the embed
        const embed = new EmbedBuilder()
            .setTitle("Player suspended!")
            .setColor([255, 0, 0])
            .setDescription(`${suspendedUser} \`${suspendedUser.user.tag}\` has been suspended from the league for **${duration}** due to **${reason}**!
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

        return interaction.editReply({ content:`${suspendedUser} has been successfully suspended!`, ephemeral:true});

        

    }
}
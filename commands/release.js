const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder, Embed } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const {maxPlayers} = require('../config.json')

const userOption = new SlashCommandUserOption();
userOption.setRequired(true);
userOption.setName('player');
userOption.setDescription('The player to sign');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('release')
        .setDescription('Release a player from a team.')
        .addUserOption(userOption),
    async execute(interaction) {
        const db = await getDBConnection();
        const guild = interaction.guild.id

        // check if a transaction channel has been set
        const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        if (!transactionExists) {
            return interaction.editReply({ content: "A transaction channel has not been set!", ephemeral: true})
        }

        // first, check and see if the user that sent the command is authorized to release a player (as in, they are a FO or GM)
        const userSent = interaction.user.id;
        const info = await db.get('SELECT p.team, p.role, t.logo, t.playercount FROM Players p, Teams t WHERE p.discordid = ? AND p.guild = ?', [userSent, guild]);
        if (!info || info.role === "P") {
            await db.close();
            return interaction.editReply({ content:'You are not authorized to release a player!', ephemeral:true });
        }
        // gets all information that the user sent
        const user = interaction.options.getMember('player');
        const userid = user.id;

        if (user.id === interaction.user.id) {
            return interaction.editReply({ content:"You are not allowed to release yourself!", ephemeral:true })
        }

        // then, check to see if the user is already without a team
        const userSigned = await db.get('SELECT team, role FROM Players WHERE discordid = ? AND guild = ?', [user.id, guild]);
        if (!userSigned) {
            await db.close();
            return interaction.editReply({ content:`This user is not currently in a team!`, ephemeral:true });
        }

        // checks to see if FO or GM is on the same team as player being released
        if (!(info.team === userSigned.team)) {
            await db.close();
            return interaction.editReply({ content:'You cannot release this user since they are not on the same team as you!', ephemeral:true })
        }

        // then, release the user
        await db.run('UPDATE Players SET team = "FA", role = "P" WHERE discordid = ? AND guild = ?', [userid, guild]);

        // then, increment the team's player count by 1
        await db.run('UPDATE Teams SET playercount = playercount - 1 WHERE code = ? AND guild = ?', [info.team, guild])

        // then, remove the role from the user
        // update this to remove gm/hc roles if necessary
        const role = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [info.team, guild]);
        const roleObj = await interaction.guild.roles.fetch(role.roleid)
        await user.roles.remove(role.roleid);

        if (userSigned.role !== "P") {
            const specialRole = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [userSigned.role, guild])
            await user.roles.remove(specialRole.roleid);
        }


        // then, get the team logo and player count
        const logo = await db.get('SELECT logo, playercount FROM Teams WHERE code = ? AND guild = ?', [info.team, guild]);
        const playerCount = logo.playercount
        const logoStr = logo.logo;

        // then, get the transaction channel ID and send a transaction message
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        const playerCountQry = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', [guild])

        const transactionEmbed = new EmbedBuilder()
            .setTitle("Player released!")
            .setThumbnail(logoStr)
            .setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
            .addFields(
                {name:"Player", value:`${user}\n${user.user.tag}`},
                {name:"Team", value:`${roleObj}`}
            )
            .setFooter({ text:`Roster size: ${playerCount} / ${playerCountQry.maxplayers} • This player was released by ${interaction.user.tag}`})

        await transactionChannel.send({ embeds: [transactionEmbed] });
        await interaction.editReply({ content:`${user} was successfully released!`, ephemeral:true})
        await db.close();
    }
}
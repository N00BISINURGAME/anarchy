const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const userOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('player')
    .setDescription('The player whose role you want to change');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('demote')
        .setDescription('Demote a specific player from a role on the team.')
        .addUserOption(userOption),
    async execute(interaction) {
        const db = await getDBConnection();

        const userId = interaction.user.id;
        const userChoice = interaction.options.getMember('player');

        // check if the user is trying to assign themselves a role

        if (userId === userChoice.id) return interaction.editReply({ content:'You are unable to demote yourself!', ephemeral:true });

        // first, check to see if the player is an FO
        const isFO = await db.get('SELECT * FROM Players WHERE discordid = ? AND role = "FO"', userChoice.id);
        if (isFO) {
            // then, check if the user running the command is an admin
            if (!admins.includes(userId)) {
                await db.close()
                return interaction.editReply({ content:"You are not authorized to demote franchise owners!", ephemeral:true })
            }
            await db.run('UPDATE Players SET team = "FA", role = "P", contractlength = -1 WHERE discordid = ?', userChoice.id)
            await db.run('UPDATE Teams SET playercount = playercount - 1 WHERE code = ?', isFO.team)
            await db.close()
            return interaction.editReply({ content:"Successfully demoted franchise owner down!", ephemeral:true })
        }
        
        // if the choice is to assign a general manager or head coach, check if they are authorized.
        // this means the person must be a franchise owner.
        const userInfo = await db.get('SELECT team FROM Players WHERE discordid = ? AND role = "FO"', userId);
        if (!userInfo) {
            await db.close();
            return interaction.editReply({ content:`You are not authorized to demote a player! To do so you must be a franchise owner.`, ephemeral:true });
        }

        // then, check to see if the user pinged is on the same team as the user who ran the command
        const chosenUserId = userChoice.id;
        const userOnTeam = await db.get('SELECT * FROM Players WHERE discordid = ? AND team = ?', [chosenUserId, userInfo.team]);
        if (!userOnTeam) {
            await db.close();
            return interaction.editReply({ content:'This user is not signed to your team!', ephemeral:true });
        }

        if (userOnTeam.role === "P") {
            await db.close()
            return interaction.editReply({ content:'This user is not a member of your front office!', ephemeral:true });
        }

        // then, take away the role from the person
        const currentRole = await db.get("SELECT role FROM Players WHERE discordid = ?", chosenUserId);
        if (currentRole.role === "GM") {
            const roleId = await db.get("SELECT roleid FROM Roles WHERE code = 'GM'");
            await userChoice.roles.remove(roleId.roleid);
        } else {
            const roleId = await db.get("SELECT roleid FROM Roles WHERE code = 'HC'");
            await userChoice.roles.remove(roleId.roleid);
        }

        // then, change the role of the user
        await db.run('UPDATE Players SET role = "P" WHERE discordid = ?', [chosenUserId]);

        // then, get the team logo
        const logo = await db.get('SELECT logo FROM Teams WHERE code = ?', userInfo.team);
        const logoStr = logo.logo;

        // get role
        const role = await db.get('SELECT roleid FROM Roles WHERE code = ?', userInfo.team);
        const roleObj = await interaction.guild.roles.fetch(role.roleid)

        const transactionEmbed = new EmbedBuilder()
            .setTitle('Player demoted!')
            .setThumbnail(logoStr)
            .addFields(
                { name:"Team", value:`${roleObj}` },
                { name:"Franchise Owner", value:`${interaction.user}\n${interaction.user.tag}` },
                { name:"Player Demoted", value:`${userChoice}`},
                { name:"Role", value: userOnTeam.role === "GM" ? "General Manager" : "Head Coach" }
            )
        
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions"')
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        await transactionChannel.send({ embeds: [transactionEmbed] })
        await interaction.editReply("Successfully demoted user!");
        // two branches: one for assigning FO and one for assigning GM/HC
        await db.close();
    }
}
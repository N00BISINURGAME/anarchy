const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const userOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('player')
    .setDescription('The player whose role you want to change');

const roleOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName('role')
    .setDescription('The role to assign the user')
    .addChoices(
        {name:"General Manager", value:"GM"},
        {name:"Head Coach", value:"HC"}
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote a specific player to a role on the team.')
        .addUserOption(userOption)
        .addStringOption(roleOption),
    async execute(interaction) {
        const db = await getDBConnection();

        const userId = interaction.user.id;
        const roleChoice = interaction.options.getString('role');
        const userChoice = interaction.options.getMember('player');

        // check if the user is trying to assign themselves a role

        if (userId === userChoice.id) return interaction.editReply({ content:'You cannot assign yourself a role!', ephemeral:true });

        // if the choice is to assign a general manager or head coach, check if they are authorized.
        // this means the person must be a franchise owner.
        const userInfo = await db.get('SELECT team FROM Players WHERE discordid = ? AND role = "FO"', userId);
        if (!userInfo) {
            await db.close();
            return interaction.editReply({ content:`You are not authorized to assign a ${roleChoice}! To do so you must be a franchise owner.`, ephemeral:true });
        }

        // then, check to see if the user pinged is on the same team as the user who ran the command
        const chosenUserId = userChoice.id;
        const userOnTeam = await db.get('SELECT * FROM Players WHERE discordid = ? AND team = ?', [chosenUserId, userInfo.team]);
        if (!userOnTeam) {
            await db.close();
            return interaction.editReply({ content:'This user is not signed to your team!', ephemeral:true });
        }

        // then, check to see if the role is taken or not
        const roleTaken = await db.get('SELECT * FROM Players WHERE role = ? AND team = ?', [roleChoice, userInfo.team]);

        if (roleTaken) {
            await db.close();
            return interaction.editReply({ content:'This role has already been filled!', ephemeral:true });
        }

        // then, check to see if they already have a role on the team
        const hasRole = await db.get('SELECT role FROM Players WHERE discordid = ?', chosenUserId);
        if (hasRole.role === "GM" || hasRole.role === "HC") {
            await db.close();
            return interaction.editReply({ content:'This user already has a front office role!', ephemeral:true });
        }

        // then, change the role of the user
        await db.run('UPDATE Players SET Role = ? WHERE discordid = ?', [roleChoice, chosenUserId]);

        // then, check if GM or HC role is created. if not, create it
        const gmRole = await db.get('SELECT roleid FROM Roles WHERE code = ?', roleChoice);
        if (!gmRole) {
            // this means the role doesn't exist. create the role and log it
            const newRole = await interaction.guild.roles.create({
                name: roleChoice === "GM" ? "General Manager" : "Head Coach"
            });

            await db.run('INSERT INTO Roles (code, roleid) VALUES (?, ?)', roleChoice, newRole.id);

            await userChoice.roles.add(newRole);
        } else {
            const role = await interaction.guild.roles.fetch(gmRole.roleid);

            await userChoice.roles.add(role);
        }

        // then, get the team logo
        const logo = await db.get('SELECT logo FROM Teams WHERE code = ?', userInfo.team);
        const logoStr = logo.logo;

        // get team role
        const role = await db.get('SELECT roleid FROM Roles WHERE code = ?', userInfo.team);
        const roleObj = await interaction.guild.roles.fetch(role.roleid)

        // then, create the embed
        const transactionEmbed = new EmbedBuilder()
            .setTitle('Player promoted!')
            .setThumbnail(logoStr)
            .addFields(
                { name:"Team", value:`${roleObj}` },
                { name:"Franchise Owner", value:`${interaction.user}` },
                { name:"Player Promoted", value:`${userChoice}`},
                { name:"Role", value: roleChoice === "GM" ? "General Manager" : "Head Coach" }
            )
        
        // then, get the transaction channel ID and send a transaction message
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions"')
        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        await transactionChannel.send({ embeds: [transactionEmbed] })
        
        await interaction.editReply({ content:"Successfully promoted user!", ephemeral:true })
        // two branches: one for assigning FO and one for assigning GM/HC
        await db.close();
    }
}
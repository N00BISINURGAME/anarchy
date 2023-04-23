const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandRoleOption, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers } = require('../config.json');

const team1Option = new SlashCommandRoleOption()
    .setRequired(true)
    .setName("first-team")
    .setDescription("The first team")

const team2Option = new SlashCommandRoleOption()
    .setRequired(true)
    .setName("second-team")
    .setDescription("The second team")

const team1Score = new SlashCommandIntegerOption()
    .setRequired(true)
    .setName('first-team-score')
    .setDescription("The score for the first team")

const team2Score = new SlashCommandIntegerOption()
    .setRequired(true)
    .setName('second-team-score')
    .setDescription("The score for the second team")


module.exports = {
    data: new SlashCommandBuilder()
        .setName('results')
        .setDescription('Updates game results.')
        .addRoleOption(team1Option)
        .addRoleOption(team2Option)
        .addIntegerOption(team1Score)
        .addIntegerOption(team2Score),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        const guild = interaction.guild.id
        const adminAuth = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        const managerAuth = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user, guild])
        if (!adminAuth && !managerAuth) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to report game results!", ephemeral: true });
        }

        // get user input
        const team1Role = interaction.options.getRole("first-team")
        const team2Role = interaction.options.getRole("second-team")
        const team1ScoreInt = interaction.options.getInteger("first-team-score")
        const team2ScoreInt = interaction.options.getInteger("second-team-score")

        if (team1Role === team2Role) {
            return interaction.editReply({ content:"Command failed! Ensure that team 1 and team 2 are different.", ephemeral:true })
        }

        // then, check if the two teams pinged are actual teams
        // note, use a sql join
        const teams = await db.all("SELECT t.code, t.name FROM Teams t, Roles r WHERE r.code = t.code AND (r.roleid = ? OR r.roleid = ?) AND r.guild = ?", [team1Role.id, team2Role.id, guild])

        // if teams length is less than 2, that means not all teams passed in are valid. so, check and send an ephmeral message
        if (teams.length < 2) {
            // find out which team is invalid. index 0 of the array always contains the valid team
            // also need a case for if both teams are invalid
            if (teams.length === 0) {
                return interaction.editReply({ content: `${team1Role} and ${team2Role} are invalid teams! Ensure that both teams you're passing in are valid!`, ephemeral:true })
            }
            const invalidTeam = teams[0].name === team1Role.name ? team2Role : team1Role

            return interaction.editReply({ content:`${invalidTeam} does not constitute a valid team! Ensure that both teams you're passing in are valid!`, ephemeral:true })
        }

        // if team 1 scored less, save the role. else, if they tied, save null and otherwise save team 2 role; nested ternary operator
        const teamWon = (team1ScoreInt > team2ScoreInt) ? team1Role : (team1ScoreInt === team2ScoreInt ? null : team2Role)

        if (team1ScoreInt === team2ScoreInt && team1ScoreInt === -25) {
            const embed = new EmbedBuilder()
            .setTitle("Incoming game results!")
            .setDescription(`Results posted by ${interaction.user}`)
            .addFields(
                {name:"Forfeit Tie!", value:`${team1Role} and ${team2Role} will both receive -25 points against
                their differential.`}
            )
            await db.run('UPDATE Teams SET ties = ties + 1, ptdifferential = ptdifferential - 25 WHERE name = ? OR name = ? AND guild = ?', [team1Role.name, team2Role.name, guild])
            // then, get the transaction channel ID and send a transaction message
            const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "results" AND guild = ?', guild)

            const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

            await transactionChannel.send({ embeds: [embed]});
            await interaction.editReply({ content:"Successfully posted results!", ephemeral:true })

            await db.close();
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("Incoming game results!")
            .setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })

        if (teamWon) {
            const imageLink = await db.get("SELECT t.logo FROM Teams t, Roles r WHERE r.roleid = ? AND r.code = t.code AND t.guild = ?", [teamWon.id, guild])
            embed.setThumbnail(imageLink.logo)
            embed.setColor(teamWon.color)
        } else {
            embed.setThumbnail(interaction.guild.iconURL())
        }

        // first team is always winner, second team is always loser
        const firstTeamRole = team1ScoreInt > team2ScoreInt ? team1Role : team2Role
        const firstTeamScore = team1ScoreInt > team2ScoreInt ? team1ScoreInt : team2ScoreInt
        const secondteamRole = team1Role === firstTeamRole ? team2Role : team1Role
        const secondTeamScore = team1ScoreInt === firstTeamScore ? team2ScoreInt : team1ScoreInt

        const id = Date.now()
        await db.run('INSERT INTO Results (winner, winnerscore, loser, loserscore, guild, id) VALUES (?, ?, ?, ?, ?, ?)', [firstTeamRole.name, firstTeamScore, secondteamRole.name, secondTeamScore, guild, id])

        // then, increment the point differential. two cases: one where there is no tie, and one where there is a tie
        if (teamWon) {
            await db.run('UPDATE Teams SET wins = wins + 1, allwins = allwins + 1, ptdifferential = ptdifferential + ? WHERE name = ? AND guild = ?', [firstTeamScore - secondTeamScore, firstTeamRole.name, guild])
            await db.run('UPDATE Teams SET losses = losses + 1, alllosses = alllosses + 1, ptdifferential = ptdifferential - ? WHERE name = ? AND guild = ?', [firstTeamScore - secondTeamScore, secondteamRole.name, guild])
        } else {
            await db.run('UPDATE Teams SET ties = ties + 1, allties = allties + 1 WHERE (name = ? OR name = ?) AND guild = ?', [firstTeamRole.name, secondteamRole.name, guild])
        }

        const firstTeamStandings = await db.get('SELECT wins, losses, ties, ptdifferential FROM Teams WHERE name = ? AND guild = ?', [firstTeamRole.name, guild])
        const secondTeamStandings = await db.get('SELECT wins, losses, ties, ptdifferential FROM Teams WHERE name = ? AND guild = ?', [secondteamRole.name, guild])

        if (teamWon) {
            embed.setDescription(`The ${firstTeamRole} have won against the ${secondteamRole}!\n>>> **Score:** ${firstTeamRole} ${firstTeamScore}-${secondTeamScore} ${secondteamRole}\n**${firstTeamRole.name} Record:** ${firstTeamStandings.wins}-${firstTeamStandings.losses}-${firstTeamStandings.ties}, ${firstTeamStandings.ptdifferential} point differential\n**${secondteamRole.name} Record:** ${secondTeamStandings.wins}-${secondTeamStandings.losses}-${secondTeamStandings.ties}, ${secondTeamStandings.ptdifferential} point differential\n**Staff:** ${interaction.member} (${interaction.user.tag})`)
        } else {
            embed.setDescription(`The ${firstTeamRole} have tied against the ${secondteamRole}!\n>>> **Score:** ${firstTeamRole} ${firstTeamScore}-${secondTeamScore} ${secondteamRole}\n**${firstTeamRole.name} Record:** ${firstTeamStandings.wins}-${firstTeamStandings.losses}-${firstTeamStandings.ties}, ${firstTeamStandings.ptdifferential} point differential\n**${secondteamRole.name} Record:** ${secondTeamStandings.wins}-${secondTeamStandings.losses}-${secondTeamStandings.ties}, ${secondTeamStandings.ptdifferential} point differential\n**Staff:** ${interaction.member} (${interaction.user.tag})`)
        }

        // then, get the transaction channel ID and send a transaction message
        const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "results" AND guild = ?', guild)

        const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

        await transactionChannel.send({ embeds: [embed]});
        await interaction.editReply({ content:"Successfully posted results!", ephemeral:true })

        await db.close();
    }
}
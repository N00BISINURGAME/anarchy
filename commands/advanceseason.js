const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');
const { release } = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advanceseason')
        .setDescription('Advances the season by 1 and updates contracts/rosters accordingly'),
    async execute(interaction) {
        const db = await getDBConnection();
        let dir = __dirname

        // first, check to see if the user is authorized to advance the season
        const user = interaction.user.id;
        if (!admins.includes(user)) {
            await db.close();
            return interaction.editReply("You are not authorized to advance the season!");
        }

        // then, advance the season
        let config = await fs.readFile(dir + '/../config.json', 'utf8');
        let configJSON = JSON.parse(config);
        configJSON.season++;
        let newConfig = JSON.stringify(configJSON);

        // then, update everyone's contracts unless they're a FO
        await db.run('UPDATE Players SET contractlength = contractlength - 1 WHERE NOT role = "FO" AND NOT team = "FA"')

        // then, change demands
        await db.run('UPDATE Players SET demands = 2')

        // then, update standings
        await db.run('UPDATE Teams SET wins = 0, losses = 0, ties = 0')

        // then, find all users whose contracts have expired
        const expiredContracts = await db.all('SELECT team, discordid FROM Players WHERE contractlength = 0')

        let contractStr = "";

        // then, for each player we subtract 1 from the playercount of the team they were on
        // also format the string for expired user contracts here
        for (let i = 0; i < expiredContracts.length; i++) {
            try {
                await db.run('UPDATE Teams SET playercount = playercount - 1 WHERE code = ?', expiredContracts[i].team);
                const teamRoleId = await db.get('SELECT roleid FROM Roles WHERE code = ?', expiredContracts[i].team);
                const teamName = await interaction.guild.roles.fetch(teamRoleId.roleid);
                let releasedUser = await interaction.client.users.cache.get(expiredContracts[i].discordid);
                let guildUser = await interaction.guild.members.fetch(releasedUser)
                await guildUser.roles.remove(teamName);
                contractStr += `${releasedUser} - ${teamName}\n`
            } catch(err) {
                continue
            }
        }

        if (contractStr === "") contractStr = "None"

        // then, remove all players with contractlength = 0 from database
        await db.run('UPDATE Players SET team = "FA" WHERE contractlength = 0');

        // then, set all team's records to 0

        // change this to dm players who have been released
        const embed = new EmbedBuilder()
            .setTitle(`Successfully advanced to season ${configJSON.season}!`)
            .setDescription(`**Expired Contracts:**\n${contractStr}`)

        await interaction.editReply({ embeds: [embed]});

        await db.close();
        await fs.writeFile(dir + '/../config.json', newConfig)

    }
}
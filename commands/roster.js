const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandStringOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins } = require('../config.json');

const teamOption = new SlashCommandMentionableOption().setRequired(true).setName('team').setDescription('The team to get all players from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roster')
        .setDescription('Shows all players from the specified team.')
        .addMentionableOption(teamOption),
    async execute(interaction) {
        const db = await getDBConnection();
        await interaction.guild.members.fetch()

        const team = interaction.options.getMentionable('team')

        // check to see if the team exists
        const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ?', team.id)
        console.log(team.id);
        if (!teamExists) {
            await db.close();
            return interaction.editReply("This team does not exist! Ensure you're pinging a team that exists.");
        }

        // then, get all players from the specified team
        const userInfo = await db.all('SELECT discordid, role, contractlength FROM Players WHERE team = ?', teamExists.code);

        let fo = "Vacant";
        let gm = "Vacant";
        let hc = "Vacant";
        let players = "";

        for (let i = 0; i < userInfo.length; i++) {
            try {
                const user = await interaction.client.users.fetch(userInfo[i].discordid)
                if (userInfo[i].role === "FO") fo = `${user}\n${user.tag}`;
                if (userInfo[i].role === "GM") gm = `${user} - ${userInfo[i].contractlength} season contract\n${user.tag}`;
                if (userInfo[i].role === "HC") hc = `${user} - ${userInfo[i].contractlength} season contract\n${user.tag}`;
                if (userInfo[i].role === "P") players += `${user} - ${userInfo[i].contractlength} season contract\n${user.tag}\n`;
            } catch(err) {
                console.log(err)
                console.log(userInfo[i].discordid)
                continue;
            }
        }

        if (players === "") players = "None";
        const desc = `**Franchise Owner**\n${fo}\n\n**General Manager**\n${gm}\n\n**Head Coach**\n${hc}\n\n**Players**\n${players}`

        const logo = await db.get('SELECT logo FROM Teams where code = ?', teamExists.code)

        const embed = new EmbedBuilder()
            .setTitle(`${team.name} Roster`)
            .setDescription(`${desc}`)
            .setThumbnail(logo.logo)
            // .addFields(
            //     {name:"Franchise Owner", value:fo},
            //     {name:"General Manager", value:gm},
            //     {name:"Head Coach", value:hc},
            //     {name:"Players", value:players}
            // )

        await interaction.editReply({ embeds: [embed], ephemeral:true })

        await db.close();

    }
}
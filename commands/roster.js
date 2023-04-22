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
        const guild = interaction.guild.id

        // check to see if the team exists
        const teamExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [team.id, guild])
        if (!teamExists) {
            await db.close();
            return interaction.editReply("This team does not exist! Ensure you're pinging a team that exists.");
        }

        // then, get all players from the specified team
        const teamMembers = team.members

        let fo = "Vacant";
        let gm = "Vacant";
        let hc = "Vacant";
        let players = "";

        for (const member of teamMembers.values()) {
            try {
                for (const role of member.roles.cache.keys()) {
                    const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [role, guild])
                    if (roleExists) {
                        if (roleExists.code === "FO") fo = `${member}\n${member.user.tag}`;
                        else if (roleExists.code === "GM") gm = `${member}\n${member.user.tag}`;
                        else if (roleExists.code === "HC") hc = `${member}\n${member.user.tag}`;
                        else players += `${member}\n${member.user.tag}\n`;
                    }
                }
                
            } catch(err) {
                console.log(err)
                continue;
            }
        }

        if (players === "") players = "None";
        const desc = `**Franchise Owner**\n${fo}\n\n**General Manager**\n${gm}\n\n**Head Coach**\n${hc}\n\n**Players**\n${players}`

        const logo = await db.get('SELECT logo FROM Teams where code = ? AND guild = ?', [teamExists.code, guild])

        const embed = new EmbedBuilder()
            .setTitle(`${team.name} Roster`)
            .setColor(team.color)
            .setFooter({ text: `${interaction.user.tag}`, iconURL: `${interaction.user.avatarURL()}` })
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
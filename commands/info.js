const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandMentionableOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');

const mentionableOption = new SlashCommandMentionableOption().setRequired(true).setName('mentionable').setDescription('The team or user to get info from.');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Displays info about a team or a player')
        .addMentionableOption(mentionableOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get the role or person mentioned
        const mentioned = interaction.options.getMentionable("mentionable");

        // then, get the id of the mentioned
        const id = mentioned.id;
        const guild = interaction.guild.id

        // two branches: one for pinged role, one for pinged person
        if (mentioned.user) {
            // this means we pinged a person; get information, construct an embed and do stuff
            // first, check that the id is in players. if not, send an error
            const userInfo = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [id, guild])
            if (!userInfo) {
                await db.close();
                return interaction.editReply({ content:'This user may be a bot! If you believe this is an error, please DM Donovan#3771', ephemeral:true});
            }

            // get the player's team role id. if it does not exist, it means they are a free agent
            const teamId = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [userInfo.team, guild])
            const team = (teamId ? await interaction.guild.roles.fetch(teamId.roleid) : "Free Agent")
            const role = (userInfo.role === "P" ? "Player" : (userInfo.role === "HC" ? "Head Coach" : (userInfo.role === "GM" ? "General Manager" : "Franchise Owner")))

            const avatarurl = mentioned.displayAvatarURL()
            const embed = new EmbedBuilder()
                .setTitle("User info")
                .setThumbnail(avatarurl)
                .addFields(
                    { name:"User", value:`${mentioned}`},
                    { name:"Team", value: `${team}`},
                    { name:"Role", value:`${role}`},
                    
                );
            if (userInfo.team != "FA" && userInfo.role != "FO") {
                embed.addFields(
                    { name:"Contract Length", value:`${userInfo.contractlength} ${userInfo.contractlength === 1 ? "season" : "seasons"}` }
                )
            }

            embed.addFields(
                { name:"Rings", value:`${userInfo.rings}` },
            )
            
            // then, get all stats from the user, starting with qb stats
            let qbStr = "";
            let rbStr = "";
            let wrStr = "";
            let defStr = "";
            let kStr = "";

            const qbStats = await db.get('SELECT * FROM QBStats WHERE discordid = ?', id);
            if (qbStats) {
                qbStr += `Passer Rating: ${qbStats.passer_rating}\n`
                qbStr += `Completion Percentage: ${(Math.round((qbStats.completions / qbStats.attempts) * 1000) / 10)}% (${qbStats.completions} / ${qbStats.attempts})\n`
                qbStr += `Touchdowns: ${qbStats.touchdowns}\n`
                qbStr += `Interceptions: ${qbStats.interceptions}\n`
                qbStr += `Yards: ${qbStats.yards}\n`
                embed.addFields(
                    { name:"QB Stats", value: `${qbStr}` }
                )
            }

            const rbStats = await db.get('SELECT * FROM RBStats WHERE discordid = ?', id)
            if (rbStats) {
                rbStr += `Average: ${rbStats.average}\n`
                rbStr += `Attempts: ${rbStats.attempts}\n`
                rbStr += `Touchdowns: ${rbStats.touchdowns}\n`
                rbStr += `Yards: ${rbStats.yards}`
                embed.addFields(
                    { name:"RB Stats", value: `${rbStr}` }
                )
            }

            const wrStats = await db.get('SELECT * FROM WRStats WHERE discordid = ?', id)
            if (wrStats) {
                wrStr += `Average: ${wrStats.average}\n`
                wrStr += `Catches: ${wrStats.catches}\n`
                wrStr += `Touchdowns: ${wrStats.touchdowns}\n`
                wrStr += `Yards: ${wrStats.yards}`
                embed.addFields(
                    { name:"WR Stats", value: `${wrStr}` }
                )
            }

            const defStats = await db.get('SELECT * FROM DefenseStats WHERE discordid = ?', id)
            if (defStats) {
                defStr += `Tackles: ${defStats.tackles}\n`
                defStr += `Interceptions: ${defStats.interceptions}\n`
                defStr += `Touchdowns: ${defStats.touchdowns}\n`
                defStr += `Sacks: ${defStats.sacks}\n`
                defStr += `Safeties: ${defStats.safeties}\n`
                defStr += `Fumble Recoveries: ${defStats.fumble_recoveries}`
                embed.addFields(
                    { name:"Defensive Stats", value: `${defStr}` }
                )
            }

            const kStats = await db.get('SELECT * FROM KStats WHERE discordid = ?', id)
            if (kStats) {
                kStr += `Kicking percentage: ${(Math.round((kStats.good_kicks / kStats.attempts) * 1000) / 10)}% (${kStats.good_kicks} / ${kStats.attempts})`
                embed.addFields(
                    { name:"Kicking Stats", value: `${kStr}` }
                )
            }
            // then, add inline fields
            await db.close()
            return interaction.editReply({ embeds:[embed], ephemeral:true});
        } else {

        }

        // then, check to see if the ping is a person or a team
        // const isUser = await db.get("SELECT * FROM Players WHERE discordid = ?", mentioned.id);


        await db.close();
        return interaction.editReply({ content:'check console.log!', ephemeral:true});

    }
}
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { teamJson, collegeJson } = require('./teams.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Runs the server setup prompts.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id;
        const admins = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [userid, guild])
        if (!admins) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to run setup!", ephemeral:true });
        }
        const embed = new EmbedBuilder()
            .setTitle("Welcome to the Anarchy setup!")
            .setDescription(`You will now run through the server setup. To move on to the next step of the server setup, press the green button marked "next". Note that you will have 2 minutes per step.`)

        const buttons = new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Continue')
                            .setStyle(ButtonStyle.Success))

        const addTeamMenu = new StringSelectMenuBuilder()
            .setCustomId("addteams")
            .setPlaceholder("Select an option")
            .addOptions(
                {
                    label:"Yes, scan for existing NFL teams but don't add anymore",
                    value:"1"
                },
                {
                    label:"Yes, add all NFL teams",
                    value:"2"
                },
                {
                    label:"Yes, scan for existing college teams but don't add anymore",
                    value:"3"
                },
                {
                    label:"Yes, add all college teams",
                    value:"4"
                },
                {
                    label:"No, I will use /newteam to add them all myself",
                    value:"5"
                }
                
            )
        const addTeamRow = new ActionRowBuilder().addComponents(addTeamMenu)

        let message = await interaction.editReply({ embeds:[embed], components:[buttons], ephemeral:true})
        let messageCollector

        try {
            messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 120000})
        } catch(err) {
            await db.close()
            return interaction.editReply({ content:"Setup expired! Remember that you have 2 minutes per step.", embeds:[], components:[], ephemeral:true})
        }

        embed.setTitle("Select how you want to add teams")
        embed.setDescription("You will now be prompted to select how you want to add teams. Things may not work as expected if role names are bolded. Note that you can change this at anytime by running /setup again.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[addTeamRow], ephemeral:true})
        try {
            messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 120000})
        } catch(err) {
            await db.close()
            return message.edit({ content:"Setup expired! Remember that you have 2 minutes per step.", embeds:[], components:[], ephemeral:true})
        }
        
        const teamOption = messageCollector.values[0]

        embed.setTitle("Thank you for choosing Anarchy!")
        embed.setDescription("You are done with setup! If you want to add a gametime and LFP channel, run /channel. Good luck with your league!")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[], ephemeral:true})

        const foCheck = await interaction.guild.roles.fetch()
        let foExists = false
        let gmExists = false
        let hcExists = false
        for (const role of foCheck.values()) {
            const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', role.id, guild)
            if (!roleExists) {
                if (role.name.toLowerCase().includes("franchise owner") || role.name.toLowerCase().includes("university president")) {
                    foExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", role.id, guild]);
                }
                if (role.name.toLowerCase().includes("general manager") || role.name.toLowerCase().includes("college recruiter")) {
                    gmExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["GM", role.id, guild]);
                }
                if (role.name.toLowerCase().includes("head coach") || role.name.toLowerCase().includes("head coach")) {
                    hcExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["HC", role.id, guild]);
                }
            }
        }
        if (!foExists) {
            const newRole = await interaction.guild.roles.create({
                name: "Franchise Owner",
            });

            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", newRole.id, guild]);
        }

        if (!gmExists) {
            const newRole = await interaction.guild.roles.create({
                name: "General Manager",
            });

            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["GM", newRole.id, guild]);
        }

        if (!hcExists) {
            const newRole = await interaction.guild.roles.create({
                name: "Head Coach",
            });

            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["HC", newRole.id, guild]);
        }

        // this needs to be made much better
        if (teamOption !== "5") {
            const roles = await interaction.guild.roles.fetch()
            let clonedArray = structuredClone(teamJson)
            let clonedCollege = structuredClone(collegeJson)
            for (const role of roles.values()) {
                // first, check if the role is already in the DB
                const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', role.id, guild)
                if (!roleExists) {
                    if (teamOption === "1" || teamOption === "2") {
                        for (let i = 0; i < teamJson.length; i++) {
                            const team = teamJson[i]
                            if (team.Name.toLowerCase().includes(role.name.toLowerCase())) {
                                // we have a valid team! add it to db and break
                                const teamExists = await db.get('SELECT * FROM Roles WHERE code = ? AND guild = ?', team.Abbreviation.toUpperCase(), guild)
                                if (!teamExists) {
                                    await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guild]);
                                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), role.id, guild]);
                                }
                                clonedArray.splice(i, 1)
                                break;
                            }
                        }
                    }
                    if (teamOption === "3" || teamOption === "4") {
                        for (let i = 0; i < collegeJson.length; i++) {
                            const team = collegeJson[i]
                            if (team.Name.toLowerCase().includes(role.name.toLowerCase())) {
                                // we have a valid team! add it to db and break
                                const teamExists = await db.get('SELECT * FROM Roles WHERE code = ? AND guild = ?', team.Abbreviation.toUpperCase(), guild)
                                if (!teamExists) {
                                    await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guild]);
                                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), role.id, guild]);
                                }
                                clonedCollege.splice(i, 1)
                                break;
                            }
                        }
                    }
                    
                }
            }

            if (teamOption === "2") {
                for (let team of clonedArray) {
                    const teamExists = await db.get('SELECT * FROM Teams WHERE name = ? AND guild = ?', [team.Name, guild])
                    if (!teamExists) {
                        const newRole = await interaction.guild.roles.create({
                            name: team.Name,
                            color: team.Color
                        });
                        await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guild]);
                        await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), newRole.id, guild]);
                    }
                }
            }
            if (teamOption === "4") {
                for (let team of clonedCollege) {
                    const teamExists = await db.get('SELECT * FROM Teams WHERE name = ? AND guild = ?', [team.Name, guild])
                    if (!teamExists) {
                        const newRole = await interaction.guild.roles.create({
                            name: team.Name,
                            color: team.Color
                        });
                        await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guild]);
                        await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), newRole.id, guild]);
                    }
                }
            }

        console.log(teamOption)

        await db.close()
    }
}

}

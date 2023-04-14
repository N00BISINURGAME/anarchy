const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { teams } = require('./teams.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Runs the server setup prompts.'),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, get player stats
        const userid = interaction.user.id;
        const guild = interaction.guild.id;
        const embed = new EmbedBuilder()
            .setTitle("Welcome to the Anarchy setup!")
            .setDescription(`You will now run through the server setup. To move on to the next step of the server setup, press the green button marked "next". Note that you will have 2 minutes per step.`)

        const buttons = new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Continue')
                            .setStyle(ButtonStyle.Success))

        const transactionMenu = new ChannelSelectMenuBuilder()
            .setCustomId("transactionchannel")
            .setPlaceholder("Select a transaction channel")
            .setChannelTypes(ChannelType.GuildText)
        const transactionRow = new ActionRowBuilder().addComponents(transactionMenu)

        const demandsMenu = new ChannelSelectMenuBuilder()
            .setCustomId("demandschannel")
            .setPlaceholder("Select a demands channel")
            .setChannelTypes(ChannelType.GuildText)
        const demandsRow = new ActionRowBuilder().addComponents(demandsMenu)

        const resultsMenu = new ChannelSelectMenuBuilder()
            .setCustomId("resultschannel")
            .setPlaceholder("Select a game results channel")
            .setChannelTypes(ChannelType.GuildText)
        const resultsRow = new ActionRowBuilder().addComponents(resultsMenu)

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
                    label:"No, I will use /newteam to add them all myself",
                    value:"3"
                }
            )
        const addTeamRow = new ActionRowBuilder().addComponents(addTeamMenu)

        let message = await interaction.editReply({ embeds:[embed], components:[buttons], ephemeral:true})
        let messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.Button, time: 120000})

        // prompt the user for the transaction channel
        embed.setTitle("Select a transaction channel")
        embed.setDescription("You will now be prompted to select your channels for transactions (signings, releases, promotions, etc). Note that you can change these channels at any time by running the /channel command.")
        message = await messageCollector.update({ embeds:[embed], components:[transactionRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const transactionChannelId = messageCollector.values[0]
        await db.run('DELETE FROM Channels WHERE channelid = ?', transactionChannelId)
        await db.run('INSERT INTO Channels (guild, channelid, purpose) VALUES (?, ?, "transactions")', [guild, transactionChannelId])

        embed.setTitle("Select a demands channel")
        embed.setDescription("You will now be prompted to select your channels for demand notifications. Note that you can change these channels at any time by running the /channel command.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[demandsRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const demandChannelId = messageCollector.values[0]
        await db.run('DELETE FROM Channels WHERE channelid = ?', demandChannelId)
        await db.run('INSERT INTO Channels (guild, channelid, purpose) VALUES (?, ?, "demands")', [guild, demandChannelId])

        embed.setTitle("Select a game results channel")
        embed.setDescription("You will now be prompted to select your channels for game result notifications. Note that you can change these channels at any time by running the /channel command.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[demandsRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.ChannelSelect, time: 120000})
        const resultsChannelId = messageCollector.values[0]
        await db.run('DELETE FROM Channels WHERE channelid = ?', resultsChannelId)
        await db.run('INSERT INTO Channels (guild, channelid, purpose) VALUES (?, ?, "results")', [guild, resultsChannelId])

        embed.setTitle("Select how you want to add teams")
        embed.setDescription("You will now be prompted to select how you want to add teams. Things may not work as expected if role names are bolded. Note that you can change this at anytime by running /setup again.")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[addTeamRow], ephemeral:true})
        messageCollector = await message.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 120000})
        const teamOption = messageCollector.values[0]

        embed.setTitle("Thank you for choosing Anarchy!")
        embed.setDescription("You are done with setup! If you want to add a gametime and LFP channel, run /channel. Good luck with your league!")
        // 3 options: scan for existing teams, add new teams, add teams later
        message = await messageCollector.update({ embeds:[embed], components:[], ephemeral:true})

        if (teamOption !== "3") {
            const roles = await interaction.guild.roles.fetch()
            let clonedArray = [...teams]
            let foExists = false
            let gmExists = false
            let hcExists = false
            for (const role of roles.values()) {
                // first, check if the role is already in the DB
                const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', role.id, guild)
                if (!roleExists) {
                    for (let i = 0; i < teams.length; i++) {
                        const team = teams[i]
                        if (team.Name.toLowerCase() === role.name.toLowerCase()) {
                            // we have a valid team! add it to db and break
                            await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guild]);
                            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), role.id, guild]);
                            clonedArray.splice(i, 1)
                            break;
                        }
                    }
                }
                if (role.name.toLowerCase() === "franchise owner") {
                    foExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", role.id, guild]);
                }
                if (role.name.toLowerCase() === "general manager") {
                    gmExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["GM", role.id, guild]);
                }
                if (role.name.toLowerCase() === "head coach") {
                    hcExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["HC", role.id, guild]);
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

                await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", newRole.id, guild]);
            }

            if (!hcExists) {
                const newRole = await interaction.guild.roles.create({
                    name: "Head Coach",
                });

                await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", newRole.id, guild]);
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

            const members = await interaction.guild.members.fetch();

            members.forEach(async guildMember => {
                if (!guildMember.user.bot) {
                    const id = guildMember.id;
                    // const isInServer = await db.run("SELECT * FROM Players WHERE discordid = ?", id);
                    // if (id === "1073414870365634711") {
                    //     console.log("found 1073414870365634711")
                    //     console.log(isInServer);
                    // }
                    // if (!isInServer || Object.keys(isInServer).length === 3) {
                    //     console.log(`user with id ${id} does not exist!`)
                    //     await db.run('INSERT INTO Players (team, discordid, role, contractlength) VALUES ("FA", ?, "P", "-1")', id);
                    // }
                    let roleCount = 0
                    guildMember.roles.cache.forEach(async role => {
                        const roleid = role.id;
                        const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ?', roleid)
                        if (roleExists && (roleExists.code !== "FO" && roleExists.code !== "GM" && roleExists.code !== "HC")) {
                            roleCount++;
                            await db.run("UPDATE Players SET role = 'P', contractlength = 1, team = ? WHERE discordid = ? AND guild = ?", [roleExists.code, id, guild])
                        }
                    })
                    guildMember.roles.cache.forEach(async role => {
                        const roleid = role.id;
                        const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [roleid, guild])
                        // if (roleExists) {
                        //     roleCount++;
                        //     if (roleExists.code !== "FO" && roleExists.code !== "GM" && roleExists.code !== "HC") {
                        //         await db.run("UPDATE Players SET role = 'P', contractlength = 1, team = ? WHERE discordid = ?", [roleExists.code, id])
                        //     }
                        //     if (roleExists.code === "GM" || roleExists.code === "HC") {
                        //         await db.run("UPDATE Players SET role = ? WHERE discordid = ?", [roleExists.code, id])
                        //     }
                        //     if (roleExists.code === "FO") {
                        //         await db.run("UPDATE Players SET role = 'FO', contractlength = 999 WHERE discordid = ?", [id])
                        //     }
                        // }
                        if (roleExists && (roleExists.code === "GM" || roleExists.code === "HC")) {
                            roleCount++;
                            await db.run("UPDATE Players SET role = ? WHERE discordid = ? AND guild = ?", [roleExists.code, id, guild])
                        }
                    })
                    guildMember.roles.cache.forEach(async role => {
                        const roleid = role.id;
                        const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ? AND guild = ?', [roleid, guild])
                        if (roleExists && (roleExists.code === "FO")) {
                            roleCount++;
                            await db.run("UPDATE Players SET role = 'FO', contractlength = 999 WHERE discordid = ? AND guild = ?", [id, guild])
                        }
                    })
                    // if (roleCount === 0) {
                    //     await db.run("UPDATE Players SET team = 'FA', role = 'P', contractlength = -1 WHERE discordid = ?", [id])
                    // }
                }
            })

            // update teams

            // fetch members in db
            const players = await db.all('SELECT discordid FROM Players');
            for (let i = 0; i < players.length; i++) {
                if (!members.has(players[i].discordid)) {
                    await db.run("UPDATE Players SET team = 'FA', role = 'P', contractlength = -1 WHERE discordid = ? AND guild = ?", [players[i].discordid, guild])
                }
            }

            const teams = await db.all("SELECT code FROM Teams");
            for (let i = 0; i < teams.length; i++) {
                await db.run('UPDATE Teams SET playercount = (SELECT COUNT(*) FROM Players WHERE team = ? AND guild = ?) WHERE code = ? AND guild = ?', [teams[i].code, guild, teams[i].code, guild])
            }
        }
        

        console.log(teamOption)

        await db.close()
    }
}
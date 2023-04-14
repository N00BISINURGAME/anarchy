const fs = require('node:fs');
const path = require('node:path')
const { Collection } = require('discord.js');
const { SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandAttachmentOption, EmbedBuilder } = require('discord.js');
const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../config.json');
const { getDBConnection } = require('../getDBConnection');
const { admins, maxPlayers } = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refreshcommands')
        .setDescription('Refreshes all PFLBot commands.'),
    async execute(interaction) {
        // return interaction.editReply({ content:`Not implemented yet!`, ephemeral:true })
        console.log("refreshing!")
        const db = await getDBConnection();

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
                console.log("finished!");
                let roleCount = 0
                guildMember.roles.cache.forEach(async role => {
                    const roleid = role.id;
                    const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ?', roleid)
                    if (roleExists && (roleExists.code !== "FO" && roleExists.code !== "GM" && roleExists.code !== "HC")) {
                        roleCount++;
                        await db.run("UPDATE Players SET role = 'P', contractlength = 1, team = ? WHERE discordid = ?", [roleExists.code, id])
                    }
                })
                guildMember.roles.cache.forEach(async role => {
                    const roleid = role.id;
                    const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ?', roleid)
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
                        await db.run("UPDATE Players SET role = ? WHERE discordid = ?", [roleExists.code, id])
                    }
                })
                guildMember.roles.cache.forEach(async role => {
                    const roleid = role.id;
                    const roleExists = await db.get('SELECT code FROM Roles WHERE roleid = ?', roleid)
                    if (roleExists && (roleExists.code === "FO")) {
                        roleCount++;
                        await db.run("UPDATE Players SET role = 'FO', contractlength = 999 WHERE discordid = ?", [id])
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
                await db.run("UPDATE Players SET team = 'FA', role = 'P', contractlength = -1 WHERE discordid = ?", [players[i].discordid])
            }
        }

        const teams = await db.all("SELECT code FROM Teams");
        for (let i = 0; i < teams.length; i++) {
            await db.run('UPDATE Teams SET playercount = (SELECT COUNT(*) FROM Players WHERE team = ?) WHERE code = ?', [teams[i].code, teams[i].code])
        }

        // return interaction.editReply({ content:"double check database to see if fixed", ephemeral:true });

        if (!(interaction.user.id === "168490999235084288")) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to refresh bot commands!", ephemeral:true });
        }

        // delete all offers
        const offers = await db.get("SELECT * FROM Offers")
        if (offers) {
            await db.close()
            return interaction.editReply({ content:"There are outgoing offers! Please wait!", ephemeral:true });
        }

        const commandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js'));

        delete require.cache[require.resolve("../config.json")]

        // then, add commands to the collection of commands stored in client
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, file);
            delete require.cache[require.resolve(filePath)]
            const command = require(filePath);
            interaction.client.commands.set(command.data.name, command);
        }

        return interaction.editReply({ content:`Successfully refreshed commands!`, ephemeral:true })
    }
}
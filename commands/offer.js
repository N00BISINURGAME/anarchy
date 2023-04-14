const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { SlashCommandBuilder, SlashCommandUserOption, SlashCommandStringOption, SlashCommandIntegerOption, SlashCommandNumberOption, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { message } = require('noblox.js');


let dmChannel;
let dmMessage;
let userMessage;
const userOption = new SlashCommandUserOption();
userOption.setRequired(true);
userOption.setName('player');
userOption.setDescription('The player to sign');

const contractLengthOption = new SlashCommandIntegerOption()
                                .setRequired(true)
                                .setName('contract-length')
                                .setDescription('The length of the contract')
                                .setMinValue(1)
                                .setMaxValue(3);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('offer')
        .setDescription('Offer to sign a player to a team.')
        .addUserOption(userOption)
        .addIntegerOption(contractLengthOption),
    async execute(interaction) {
        let userid;
        const guild = interaction.guild.id
        try {
            const db = await getDBConnection();
            const maxPlayerCount = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guild)
            const maxPlayers = maxPlayerCount.maxplayers
            const offerEnabled = await db.get('SELECT offers FROM Leagues WHERE guild = ?', guild)
            if (!offerEnabled.offers) return interaction.editReply({ content: "Offers are disabled for the postseason!", ephemeral: true})

            // check if a transaction channel has been set
            const transactionExists = await db.get('SELECT * FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)
            if (!transactionExists) {
                return interaction.editReply({ content: "A transaction channel has not been set!", ephemeral: true})
            }

            // gets all information that the user sent
            let userPing = interaction.options.getMember('player');
            let user = await interaction.guild.members.fetch(userPing.id)
            const contractLen = interaction.options.getInteger('contract-length');
            let userid = user.id;

            if (user.id === interaction.user.id) {
                return interaction.editReply({ content:"You are not allowed to release yourself!", ephemeral:true })
            }

            // first, check to see if the user is in the database
            const inDB = await db.get("SELECT * FROM Players WHERE discordid = ? AND guild = ?", [userid, guild]);
            if (!inDB) {
                await db.run("INSERT INTO Players (team, discordid, role, contractlength, rings, guild) VALUES ('FA', ?, 'P', -1, 0, ?)", [userid, guild]);
            }

            // first, check and see if the user that sent the command is authorized to sign a player (as in, they are a FO or GM)
            const userSent = interaction.user.id;
            const info = await db.get('SELECT p.team FROM Players p WHERE p.discordid = ? AND (p.role = "FO" OR p.role = "GM") AND guild = ?', [userSent, guild]);
            if (!info) {
                await db.close();
                return interaction.editReply({ content:'You are not authorized to sign a player!', ephemeral:true});
            }

            // then, check if the user already has an outgoing offer
            const existingOffer = await db.get("SELECT * FROM Offers where discordid = ?", user.id);
            if (existingOffer) {
                await db.close();
                return interaction.editReply({ content:"This user already has an outgoing offer. Please try again later.", ephemeral:true })
            }

            // then, get the team logo
            const logo = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [info.team, guild]);
            const logoStr = logo.logo;

            // get role id
            const role = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [info.team, guild]);
            const roleObj = await interaction.guild.roles.fetch(role.roleid)

            // then, check to see if the user is already signed
            const userSigned = await db.get('SELECT team FROM Players WHERE discordid = ? AND NOT team = "FA" AND guild = ?', [user.id, guild]);
            if (userSigned) {
                // then, get the team that the player is signed on
                const team = await db.get('SELECT roleid FROM roles WHERE code = ? AND guild = ?', [userSigned.team, guild]);
                const teamRole = await interaction.guild.roles.fetch(team.roleid);
                await db.close();
                return interaction.editReply({content:`This user has already been signed by the ${teamRole}!`, ephemeral:true});
            }

            // then, check to see if signing the player would lead to exceeding the maximum player count
            let playersOnTeam = await db.get('SELECT COUNT(*) AS playerCount FROM Players WHERE team = ? AND guild = ?', [info.team, guild]);
            if (playersOnTeam.playerCount + 1 > maxPlayers) return interaction.editReply({content:'Signing this player would lead to your team exceeding the maximum player count!', ephemeral:true});

            // then, get channel information and send an ephemeral reply to the command saying a user has been offered
            // also create the dm message, format it properly, and send it to the user and listen for a button click
            const userObj = interaction.client.users.cache.get(user.id)
            dmChannel = await userObj.createDM()

            dmMessage = new EmbedBuilder()
                .setTitle("Incoming Offer!")
                .setThumbnail(logoStr)
                .setDescription("To accept or decline, press the green or red button on this message. You have 15 minutes to accept.")
                .addFields(
                    {name:"Contract Details", value:`The ${roleObj.name} in ${interaction.guild.name} have offered you a ${contractLen} season contract.`}
                )

            const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('accept')
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('decline')
                            .setLabel('Decline')
                            .setStyle(ButtonStyle.Danger)
                    )

            userMessage = await dmChannel.send({embeds: [dmMessage], components: [buttons]})
            await db.run("INSERT INTO Offers (discordid) VALUES (?)", user.id);
            await interaction.editReply({ content: "Offer has been sent. Awaiting decision...", ephemeral: true})
            const dmInteraction = await userMessage.awaitMessageComponent({ componentType: ComponentType.Button, time: 890000})

            if (dmInteraction.customId === "accept") {
                // check again to see if player count would be exceeded
                playersOnTeam = await db.get('SELECT COUNT(*) AS playerCount FROM Players WHERE team = ? AND guild = ?', [info.team, guild]);
                if (playersOnTeam.playerCount + 1 > maxPlayers) {
                    const failEmbed = new EmbedBuilder()
                        .setTitle("Signing failed")
                        .setDescription(`${info.team} has signed too many players, and can no longer sign you without going over the maximum player cap.`)
                    return dmInteraction.update({ embeds: failEmbed, components: [] })
                }

                // check if the player signed to another team
                const playerResigned = await db.get('SELECT team FROM Players WHERE discordid = ? AND NOT team = "FA" AND guild = ?', [user.id, guild]);
                if (playerResigned) {
                    const failEmbed = new EmbedBuilder()
                        .setTitle("Signing failed")
                        .setDescription(`You have already signed to another team.`)
                    return dmInteraction.update({ embeds: failEmbed, components: [] })
                }

                // then, sign the user and give them the role they need
                await db.run('UPDATE Players SET team = ?, contractlength = ? WHERE discordid = ? AND guild = ?', [info.team, contractLen, userid, guild]);

                // then, increment the team's player count by 1
                await db.run('UPDATE Teams SET playercount = playercount + 1 WHERE code = ? AND guild = ?', [info.team, guild])
                const guildUser = await interaction.guild.members.fetch(user)
                await guildUser.roles.add(roleObj);

                // then, get the transaction channel ID and send a transaction message
                const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guild)

                const transactionChannel = await interaction.guild.channels.fetch(channelId.channelid);

                let contractLenStr = contractLen === 1 ? "1 season" : `${contractLen} seasons`

                const transactionEmbed = new EmbedBuilder()
                    .setTitle("Player signed!")
                    .setThumbnail(logoStr)
                    .addFields(
                        {name:"Player", value:`${user}\n${user.user.tag}`},
                        {name:"Team", value:`${roleObj}`},
                        {name:"Length", value: contractLen === 1 ? "1 season" : `${contractLen} seasons`}
                    )
                    .setFooter({ text:`Roster size: ${playersOnTeam.playerCount + 1} / ${maxPlayers} • This player was signed by ${interaction.user.tag}`})

                dmMessage.setTitle("Successfully signed!")

                await dmInteraction.update({ embeds: [dmMessage], components: []})
                await interaction.editReply({ content:"Offer accepted!", ephemeral:true })
                await transactionChannel.send({ embeds: [transactionEmbed] })
            } else if (dmInteraction.customId === "decline") {
                dmMessage.setTitle("Offer rejected!")
                await dmInteraction.update({ embeds: [dmMessage], components: [] })
                await interaction.editReply({ content:"Offer rejected!", ephemeral:true })
            } else {
                
                await dmInteraction.update({ content:"An error has occured! Please ask your FO to send another offer", components: [] })
                await interaction.editReply({ content:"Error, please DM Donovan#3771 with a description of what happened", ephemeral:true })
            }
            await db.run("DELETE FROM Offers WHERE discordid = ?", user.id);
            await db.close();
        } catch(err) {
            await interaction.client.users.send("168490999235084288", `Error for user ${interaction.user.tag}\n\n ${err}`)
            console.log(err)
            const db = await getDBConnection();
            await db.run("DELETE FROM Offers WHERE discordid = ?", userid);
            if (err.code === "InteractionCollectorError") {
                dmMessage.setTitle("Offer Expired!")
                await userMessage.edit({ embeds: [dmMessage], components: []})
             } else if (err.code === 50007) {
                await interaction.editReply({ content: "This user does not have their DMs open to bots! Ensure that this user can be DMed by bots before sending them another offer!", ephemeral:true })
            } else {
                const errmsg = `There was an error while executing ${interaction.commandName}! Please DM Donovan#3771 with a screenshot of this error to report this bug.\n\n Attach this error message below:\`\`\`${err}\`\`\``
                await interaction.editReply({ content:errmsg, ephemeral:true })
            }
            await db.close();
        }
    }
}
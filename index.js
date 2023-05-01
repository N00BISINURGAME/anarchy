const fs = require('node:fs');
const path = require('node:path');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const { getDBConnection } = require('./getDBConnection');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Embed, PermissionsBitField } = require('discord.js');
const { token, presenceData, maxPlayers, filter, clientId, guildId } = require('./config.json');
const { REST, Routes } = require('discord.js');
const { teamJson, collegeJson } = require('./commands/teams.json')

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages], presence: presenceData });

client.commands = new Collection();
client.cooldowns = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async () => {
	try {
		const guilds = await client.guilds.fetch()
		if (client.user.id === "1094711775414460416") {
			const embed = new EmbedBuilder()
				.setTitle("We are moving to a new bot!")
				.setThumbnail(client.user.avatarURL())
				.setDescription(`Due to complications with our current bot, we are moving bots to a different version of Anarchy. **There is no loss of data as a result of this change.**
				\nTo add the bot, click the button below. We apologize for the inconvenience.`)

			let button = new ActionRowBuilder()
				.addComponents(new ButtonBuilder()
						.setLabel("Invite the new Anarchy!")
						.setStyle(ButtonStyle.Link)
						.setURL(`https://discord.com/api/oauth2/authorize?client_id=1098837048187682816&permissions=8&scope=applications.commands%20bot`),
						new ButtonBuilder()
						.setLabel("Join our support server!")
						.setStyle(ButtonStyle.Link)
						.setURL("https://discord.gg/TuKy4sPcE8"))
			for (const guild of guilds.values()) {
				const fetchedGuild = await guild.fetch()
				let channel;
				for (const chan of fetchedGuild.channels.cache.values()) {
					if (chan.isTextBased()) {
						channel = chan;
						break
					}
				}
				try {
					const otherBotExists = await fetchedGuild.members.fetch("1098837048187682816")
					if (!otherBotExists) {
						await channel.send({ embeds:[embed], components:[button]})
					}
				} catch(err) {
					if (err.code === 10007) {
						console.log(channel)
						try {
							await channel.send({ embeds:[embed], components:[button]})
						} catch(err) {
							console.log(err)
						}
					}
					console.log(err)
				}
			}
			console.log("printed message")
			return
		}
		const db = await getDBConnection()
		await db.run("DELETE FROM Offers")
		

		guilds.forEach(async guild => {
			let guildFetched = await guild.fetch()
			await guildFetched.members.fetch()
		})

		for (const guild of guilds.values()) {
			const fetchedGuild = await guild.fetch()
			const roles = await db.all('SELECT * FROM Roles WHERE guild = ?', fetchedGuild.id)
			for (const role of roles) {
				const roleExists = await fetchedGuild.roles.fetch(role.roleid);
				if (!roleExists) {
					console.log('deleting roles')
					await db.run('DELETE FROM Roles WHERE roleid = ? AND guild = ?', [role.roleid, guild.id])
				}
			}
		}
		console.log('Ready!');
		await db.close()
	} catch(err) {
		console.log(err)
		console.log("offers not deleted!");
	}
});

// when a command is run
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	const { cooldowns } = client;

	if (!cooldowns.has(command.data.name)) {
		cooldowns.set(command.data.name, new Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.data.name);
	const defaultCooldownDuration = 3;
	const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;
	if (timestamps.has(interaction.user.id)) {
		const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

		if (now < expirationTime) {
			const expiredTimestamp = Math.round(expirationTime / 1000);
			return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
		}
	}
	timestamps.set(interaction.user.id, now);
	setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
	try {
		await interaction.deferReply({ ephemeral:true })
		if (client.user.id === "1094711775414460416") {
			return interaction.editReply("This copy of Anarchy is down, add this one instead! https://discord.com/api/oauth2/authorize?client_id=1098837048187682816&permissions=8&scope=bot")
		}
		const db = await getDBConnection()
		await client.users.fetch(interaction.user.id) // fetch the user and cache them for future use
		const user = interaction.member
		// temp fix for fixing team stuff
		const guild = interaction.guild.id

		console.log(guild)

		const guildExists = await db.get('SELECT * FROM Leagues WHERE guild = ?', guild)
		console.log(guildExists)
		if (!guildExists) {
			await db.run("INSERT INTO Leagues (guild, season, offers, filter, maxplayers, demands) VALUES (?, ?, ?, ?, ?, ?)", [guild, 1, 1, 0, 18, 2])
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", ["168490999235084288", guild])
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [interaction.guild.ownerId, guild])

			const members = await interaction.guild.members.fetch()

			members.forEach(async guildMember => {
				const userExists = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [guildMember.id, guild])
				if (!guildMember.user.bot && !userExists) {
					const id = guildMember.id;
					await db.run('INSERT INTO Players (discordid, guild) VALUES (?, ?)', [id, guild]);
				}
			})
		}

		// as a sanity check, ensure the user exists in the database
		const userExists = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [user.id, guild])
		if (!userExists) {
			await db.run('INSERT INTO Players (discordid, guild) VALUES (?, ?)', [user.id, guild]);
		}

		// get all roles, and also get the highest role of a guild
		const userRoles = user.roles.cache
		const highestRole = interaction.guild.roles.highest
		const exists = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user.id, guild])
		if (!exists) {
			if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
				await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [user.id, guild])
			}
			if (userRoles.get(highestRole.id)) {
				await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [user.id, guild])
			}
	
			for (const role of userRoles.values()) {
				if (role.name.toLowerCase().includes("commissioner") || role.name.toLowerCase().includes("founder")) {
					await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [user.id, guild])
					break;
				}
			}
		} else {
			if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
				await db.run("DELETE FROM Admins WHERE discordid = ? AND guild = ?", [user.id, guild])
			}
		}

		await db.close()
		await command.execute(interaction);
	} catch (error) {
		try {
			const embed = new EmbedBuilder()
			.setTitle("An error has occured!")
			.setFields(
				{name:"User", value:`${interaction.user.tag}`},
				{name:"Guild ID", value:`${interaction.guild.id}`},
				{name:"Guild Name", value:`${interaction.guild.name}`},
				{name:"Command that caused error", value:`${interaction.commandName}`},
				{name:"Error message", value:`${error.stack}`}
			)
			if (interaction.guild.iconURL()) {
				embed.setImage(interaction.guild.iconURL())
			}
			try {
				const errorChannel = await client.channels.fetch("1095573451999281227");
				await errorChannel.send({embeds:[embed]})
			} catch(err) {
				console.log(err)
			}
			await client.users.send("168490999235084288", {embeds:[embed]})
			await interaction.editReply({content:`An error has occured! Please DM Donovan#3771 with the following screenshot and explain what happened that caused the error:\n\n${error}`})
			console.error(error);
		} catch(err) {
			console.log(err)
		}
	}
});

// when the bot joins a guild
client.on(Events.GuildCreate, async guild => {
	try {
		if (client.user.id === "1094711775414460416") {
			return;
		}
		const members = await guild.members.fetch();
		const db = await getDBConnection();
		const guildid = guild.id

		const guildExists = await db.get('SELECT * FROM Leagues WHERE guild = ?', guildid);

		let joinChannel;

		for (const channel of guild.channels.cache.values()) {
			if (channel.isTextBased()) {
				joinChannel = channel;
				break;
			}
		}

		try {
			const serverOwner = await guild.members.fetch(guild.ownerId)
			const guildAddChannel = await client.channels.fetch("1095573451999281225")
			const embed = new EmbedBuilder()
				.setTitle("Anarchy has joined a new guild!")
				.setDescription(`Anarchy has joined ${guild.name}! Anarchy is now in ${client.guilds.cache.size} guild!
				\n>>> **Guild ID:** ${guild.id}\n**Server owner:** ${serverOwner.user.tag} (${guild.ownerId})\n**Member count:** ${guild.memberCount}`)
			const invites = await guild.invites.fetch()

			let button;

			if (invites.size > 0) {
				button = new ActionRowBuilder()
				.addComponents(new ButtonBuilder()
							.setLabel("Join this league!")
							.setStyle(ButtonStyle.Link)
							.setURL(`${invites.first().url}`))
			if (guild.iconURL()) {
				embed.setThumbnail(`${guild.iconURL()}`)
			}
			}
			if (button) {
				await guildAddChannel.send({ embeds:[embed], components:[button] })
			} else {
				await guildAddChannel.send({ embeds:[embed]})
			}
		} catch(err) {
			console.log(err)
		}

		const embed = new EmbedBuilder()
			.setTitle("Thank you for choosing Anarchy!")
			.setDescription(`Thank you for choosing anarchy, the newest and fastest-growing signing bot on the market.
			\nTo get started, we **highly suggest** running the /setup command, as this will guide you in choosing the core channels (transactions, demands, and game results). After running setup, you're more than free to set extra channels using the /channel command.
			\nAt any time, if you need help getting things to work you're more than free to DM Donovan#3771 or join our support server in order to get assistance debugging.
			\nEnjoy using Anarchy, and good luck with your league!
			\nTo join our support server, click the button below!`)
			.setColor([0, 0, 0])
			.setThumbnail(client.user.avatarURL())

		let button = new ActionRowBuilder()
			.addComponents(new ButtonBuilder()
					.setLabel("Join our support server!")
					.setStyle(ButtonStyle.Link)
					.setURL(`https://discord.gg/TuKy4sPcE8`))

		await joinChannel.send({ embeds:[embed], components:[button] })


		if (!guildExists) {
			await db.run("INSERT INTO Leagues (guild, season, offers, filter, maxplayers, demands) VALUES (?, ?, ?, ?, ?, ?)", [guildid, 1, 1, 0, 18, 2])
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", ["168490999235084288", guildid])
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [guild.ownerId, guildid])

			members.forEach(async guildMember => {
				if (!guildMember.user.bot) {
					const id = guildMember.id;
					await db.run('INSERT INTO Players (discordid, guild) VALUES (?, ?)', [id, guildid]);
				}
			})

			// if the guild does not exist, sync all the roles
			for (const role of guild.roles.cache.values()) {
            const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', role.id, guildid)
            if (!roleExists) {
                if (role.name.toLowerCase().includes("franchise owner") || role.name.toLowerCase().includes("university president")) {
                    foExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", role.id, guildid]);
                }
                if (role.name.toLowerCase().includes("general manager") || role.name.toLowerCase().includes("college recruiter")) {
                    gmExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["GM", role.id, guildid]);
                }
                if (role.name.toLowerCase().includes("head coach") || role.name.toLowerCase().includes("head coach")) {
                    hcExists = true
                    await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["HC", role.id, guildid]);
                }
            }
        }
        if (!foExists) {
            const newRole = await guild.roles.create({
                name: "Franchise Owner",
            });

            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["FO", newRole.id, guildid]);
        }

        if (!gmExists) {
            const newRole = await guild.roles.create({
                name: "General Manager",
            });

            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["GM", newRole.id, guildid]);
        }

        if (!hcExists) {
            const newRole = await guild.roles.create({
                name: "Head Coach",
            });

            await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', ["HC", newRole.id, guild]);
        }

				const roles = await guild.roles.fetch()
				for (const role of roles.values()) {
						// first, check if the role is already in the DB
						const roleExists = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', role.id, guild)
						if (!roleExists) {
								for (let i = 0; i < teamJson.length; i++) {
										const team = teamJson[i]
										if (team.Name.toLowerCase().includes(role.name.toLowerCase())) {
												// we have a valid team! add it to db and break
												const teamExists = await db.get('SELECT * FROM Roles WHERE code = ? AND guild = ?', team.Abbreviation.toUpperCase(), guildid)
												if (!teamExists) {
														await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guildid]);
														await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), role.id, guildid]);
												}
												break;
										}
								}
								for (let i = 0; i < collegeJson.length; i++) {
									const team = collegeJson[i]
									if (team.Name.toLowerCase().includes(role.name.toLowerCase())) {
											// we have a valid team! add it to db and break
											const teamExists = await db.get('SELECT * FROM Roles WHERE code = ? AND guild = ?', team.Abbreviation.toUpperCase(), guildid)
											if (!teamExists) {
													await db.run('INSERT INTO Teams (code, name, logo, guild) VALUES (?, ?, ?, ?)', [team.Abbreviation, team.Name, team.Logo, guildid]);
													await db.run('INSERT INTO Roles (code, roleid, guild) VALUES (?, ?, ?)', [team.Abbreviation.toUpperCase(), role.id, guildid]);
											}
											break;
									}
								}
						}
				}

				
		}

		// deploy commands
		const commands = [];

		// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
		for (const file of commandFiles) {
			const command = require(`./commands/${file}`);
			commands.push(command.data.toJSON());
		}

		const rest = new REST({ version: '10' }).setToken(token);

		(async () => {
			try {
				console.log(`Started refreshing ${commands.length} application (/) commands.`);

				// The put method is used to fully refresh all commands in the guild with the current set
				const data = await rest.put(
					Routes.applicationCommands(clientId),
					{ body: commands },
				);

				console.log(`Successfully reloaded ${data.length} application (/) commands.`);
			} catch (error) {
				// And of course, make sure you catch and log any errors!
				console.error(error);
			}
		})();

		await db.close();
	} catch(err) {
		console.log(err)
	}

})

// when a member joins
client.on(Events.GuildMemberAdd, async member => {
	// first, check if they are already in the database
	try {
		if (client.user.id === "1094711775414460416") {
			return
		}
		const db = await getDBConnection();
		const guild = member.guild.id;
		const memberData = await db.get('SELECT discordid FROM Players WHERE discordid = ? AND guild = ?', [member.id, guild]);

		// if they are not in the database, add them
		if (!memberData) {
			await db.run('INSERT INTO Players (discordid, guild) VALUES (?, ?)', [member.id, guild]);
		}

		const memberDm = await member.createDM()
		const embed = new EmbedBuilder()
			.setTitle("Make the switch to Anarchy!")
			.setThumbnail(client.user.avatarURL())
			.setDescription(`If you are the owner of a league or are considering starting a league, consider using Anarchy! We are one of the fastest-growing league utility bots on the market, and we have the tools that **you** need in order to make sure that your league able to quickly start operating at peak efficiency for any sport, offered to you completely **for free**.
			\nIf you want to invite Anarchy, click the button below!`)

		const button = new ActionRowBuilder()
			.addComponents(new ButtonBuilder()
							.setLabel("Invite Anarchy!")
							.setStyle(ButtonStyle.Link)
							.setURL("https://discord.com/api/oauth2/authorize?client_id=1094711775414460416&permissions=8&scope=bot%20applications.commands"))

		// await memberDm.send({ embeds:[embed], components:[button] })
		await db.close();
	} catch(err) {
		console.log(err)
	}
})

// when a member leaves
client.on(Events.GuildMemberRemove, async member => {
	try {
		if (client.user.id === "1094711775414460416") {
			return
		}
		const memberId = member.id;
		const guildId = member.guild.id
		const db = await getDBConnection();

		const roles = member.roles.cache

		const embed = new EmbedBuilder()
		const maxPlayers = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guildId)

		// loop thru every role of the member who left
		for (const role of roles.keys()) {
			// then, check to see if the role exists in the db; this usually means we have a team
			const roleInDb = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role, guildId])
			if (roleInDb) {
				// verify that the role we found is actually a team role
				const isTeam = await db.get('SELECT * FROM Teams WHERE code = ? AND guild = ?', [roleInDb.code, guildId])
				
				if (isTeam) {
					// this means a player left, uh oh!
					// need to find out if the franchise owner was the person who left
					const foRole = await db.get('SELECT * FROM Roles WHERE code = "FO" AND guild = ?', [guildId])
					const roleObj = await member.guild.roles.fetch(role)
					if (!roleObj) return;

					const logo = await db.get('SELECT t.logo FROM Teams t, Roles r WHERE t.code = r.code AND t.guild = r.guild AND r.roleid = ? AND r.guild = ?', [role, guildId])
					embed
						.setTitle("Player left!")
						.setColor(roleObj.color)
						.setThumbnail(logo.logo)
						.setDescription(`${member.user.tag} has left the ${roleObj} due to leaving the server!
						\n>>> **Roster:** \`${roleObj.members.size}/${maxPlayers.maxplayers}\``)
					const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guildId);
					if (roles.get(foRole.roleid)) {
						const foRoleObj = await member.guild.roles.fetch(foRole.roleid)
						embed.setTitle("Franchise Owner left!")
						.setDescription(`The ${foRoleObj} of the ${roleObj}, ${member.user.tag} has left the the server!
						\n>>> **Roster:** \`${roleObj.members.size}/${maxPlayers.maxplayers}\``)

						const noticeChannel = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guildId);
						if (noticeChannel) {
							const channel = await member.guild.channels.fetch(noticeChannel.channelid);
							await channel.send({ embeds:[embed] })
							return;
						}
					}
					if (channelId) {
						const channel = await member.guild.channels.fetch(channelId.channelid);
						await channel.send({ embeds:[embed] })
					}
					// then, check for FO existence
					for (const roleMember of roleObj.members.values()) {
						const roleMemberRoles = roleMember.roles.cache
						if (roleMemberRoles.get(foRole.roleid)) {
							embed.setDescription(`${member.user.tag} has left the ${roleObj.name} in ${member.guild.name} due to leaving the server!\n>>> **Roster:** \`${roleObj.members.size}/${maxPlayers.maxplayers}\``)
							await roleMember.send( {embeds:[embed]})
							break
						}
					}
					break
				}
			}
		}
		await db.close();
	} catch(err) {
		console.log(err)
	}
})

client.on(Events.MessageCreate, async message => {
	return;
	if (!message.author.bot) {
		const contentStr = message.content;
		const regex = /[n]+\s*.{0,5}[ixe1-9]+\s*.{0,5}[g]\s*[g]+\s*.{0,5}[eaux1-9]+\s*.{0,5}[r]+\s*.*/i;
		const match = contentStr.match(regex);
		if (match && filter) {
			try {
				// first, delete the message
				await message.delete();
				const guildUser = await message.guild.members.fetch(message.author.id);
				await guildUser.timeout(600000, "Saying the N word with hard R");
				// then, notify the user that said it to not say it again
				const channelid = message.channelId;
				const channel = await message.guild.channels.fetch(channelid);
				const embed = new EmbedBuilder()
					.setTitle("Message deleted!")
					.addFields(
						{name:"User", value:`${message.author}`},
						{name:"Reason", value:`Contained usage of the N-word with hard R`}
					)
					.setFooter({ text:`This user has been timed out for 10 minutes`});
				channel.send(
					{ embeds: [embed]}
				)
			} catch(err) {
				console.log(err);
			}
		}
	}
})

client.login(token);
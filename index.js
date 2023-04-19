const fs = require('node:fs');
const path = require('node:path');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const { getDBConnection } = require('./getDBConnection');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token, presenceData, maxPlayers, filter, clientId, guildId } = require('./config.json');
const { REST, Routes } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages], presence: presenceData });

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async () => {
	console.log('Ready!');
	try {
		const db = await getDBConnection()
		await db.run("DELETE FROM Offers")
		const guilds = await client.guilds.fetch()

		guilds.forEach(async guild => {
			let guildFetched = await guild.fetch()
			await guildFetched.members.fetch()
		})

		// first, fix the playercounts as a sanity check
		const teamCodes = await db.all('SELECT code FROM Teams');

		for (let i = 0; i < teamCodes.length; i++) {
				const team = teamCodes[i].code;
				await db.run('UPDATE Teams SET playercount = (SELECT COUNT(*) FROM Players WHERE team = ?) WHERE code = ?', [team, team])
		}

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

	try {
		const db = await getDBConnection()
		await interaction.deferReply({ ephemeral:true })
		await client.users.fetch(interaction.user.id) // fetch the user and cache them for future use
		const user = interaction.member
		// temp fix for fixing team stuff
		const guild = interaction.guild.id

		// as a sanity check, ensure the user exists in the database
		const userExists = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [user.id, guild])
		if (!userExists) {
			await db.run('INSERT INTO Players (team, discordid, guild, role, contractlength) VALUES ("FA", ?, ?, "P", "-1")', [user.id, guild]);
		}

		// get all roles, and also get the highest role of a guild
		const userRoles = user.roles.cache
		const highestRole = interaction.guild.roles.highest
		if (userRoles.get(highestRole.id)) {
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [user.id, guild])
		}

		let specialRoleInfo = null
		let teamRoleInfo = null

		const userInfo = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [user.id, guild])

		// also, check if they were manually given roles (sigh)
		for (const roleid of userRoles.keys()) {
			const roleInfo = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [roleid, guild])
			if (roleInfo) {
				// first, set flags to indicate stuff
				if (roleInfo.code === "FO" || roleInfo.code === "GM" || roleInfo.code === "HC") {
					specialRoleInfo = roleInfo
				} else {
					teamRoleInfo = roleInfo
				}
			}
		}

		// at this stage, check if teamRoleInfo is null, then check for specialRoleInfo afterwards.
		if (teamRoleInfo) {
			const contractLen = Math.floor(Math.random() * (3 - 1 + 1) + 1)
			if (userInfo.team === "FA" || userInfo.team !== teamRoleInfo.code) {
				// if a user's team in the db does not match their role, give them a random contract
				await db.run('UPDATE Players SET team = ?, contractlength = ? WHERE discordid = ? AND guild = ?', [teamRoleInfo.code, contractLen, user.id, guild])
			}
			if (specialRoleInfo && userInfo.role !== specialRoleInfo.role) {
				if (specialRoleInfo.code === "FO") {
					console.log(specialRoleInfo)
					await db.run('UPDATE Players SET role = "FO", contractlength = 999 WHERE discordid = ? AND guild = ?', [user.id, guild])
				} else {
					if (userInfo.role === "FO") {
						await db.run('UPDATE Players SET role = ?, contractlength = ? WHERE discordid = ? AND guild = ?', [specialRoleInfo.code, contractLen, user.id, guild])
					}
					await db.run('UPDATE Players SET role = ? WHERE discordid = ? AND guild = ?', [specialRoleInfo.code, user.id, guild])
				}
			} else if (!specialRoleInfo && userInfo.role !== "P") {
				// if special role info does not exist, get the current contract length
				if (userInfo.role === "FO") {
					await db.run('UPDATE Players SET role = "P", contractlength = ? WHERE discordid = ? AND guild = ?', [contractLen, user.id, guild])
				} else {
					await db.run('UPDATE Players SET role = "P" WHERE discordid = ? AND guild = ?', [user.id, guild])
				}
			}
		} else {
			// they had no team role, therefore they are a free agent
			await db.run('UPDATE Players SET role = "FA", contractlength = -1 WHERE discordid = ? AND guild = ?', [user.id, guild])
		}

		const teams = await db.all("SELECT code FROM Teams WHERE guild = ?", guild);
		for (let i = 0; i < teams.length; i++) {
				await db.run('UPDATE Teams SET playercount = (SELECT COUNT(*) FROM Players WHERE team = ? AND guild = ?) WHERE code = ? AND guild = ?', [teams[i].code, guild, teams[i].code, guild])
		}

		await db.close()
		await command.execute(interaction);
	} catch (error) {
		try {
			const embed = new EmbedBuilder()
			.setTitle("An error has occured!")
			.setThumbnail(interaction.guild.iconURL())
			.setFields(
				{name:"User", value:`${interaction.user.tag}`},
				{name:"Guild ID", value:`${interaction.guild.id}`},
				{name:"Guild Name", value:`${interaction.guild.name}`},
				{name:"Command that caused error", value:`${interaction.commandName}`},
				{name:"Error message", value:`${error}`}
			)
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
		const members = await guild.members.fetch();
		const db = await getDBConnection();
		const guildid = guild.id

		const guildExists = await db.get('SELECT * FROM Leagues WHERE guild = ?', guildid);

		if (!guildExists) {
			await db.run("INSERT INTO Leagues (guild, season, offers, filter, maxplayers) VALUES (?, 1, 1, 0, 18)", guildid)
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", ["168490999235084288", guildid])
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [guild.ownerId, guildid])

			members.forEach(async guildMember => {
				if (!guildMember.user.bot) {
					const id = guildMember.id;
					await db.run('INSERT INTO Players (team, discordid, guild, role, contractlength) VALUES ("FA", ?, ?, "P", "-1")', [id, guildid]);
				}
			})
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
		const db = await getDBConnection();
		const guild = member.guild.id;
		const memberData = await db.get('SELECT discordid FROM Players WHERE discordid = ? AND guild = ?', [member.id, guild]);

		// if they are not in the database, add them
		if (!memberData) {
			await db.run('INSERT INTO Players (team, discordid, guild, role, contractlength) VALUES ("FA", ?, ?, "P", "-1")', [member.id, member.guild.id]);
		}
		await db.close();
	} catch(err) {
		console.log(err)
	}
})

// when a member leaves
client.on(Events.GuildMemberRemove, async member => {
	try {
		const memberId = member.id;
		const guildId = member.guild.id
		const db = await getDBConnection();

		const maxPlayers = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', member.guild.id)

		// if a member leaves, check to see if they are a player. if they are, remove them as a player.
		const playerData = await db.get('SELECT * FROM Players WHERE discordid = ? AND guild = ?', [memberId, guildId]);
		if (!playerData) {
			return;
		}
		// rewrite this part
		if (playerData && playerData.team !== "FA") {
			// first, decrement the number of players on the team the player used to be on
			query = "UPDATE Teams SET playercount = playercount - 1 WHERE code = ? AND guild = ?"
			await db.run(query, [playerData.team, guildId]);
			await db.run("UPDATE Players SET team = 'FA', role = 'P', contractlength = -1 WHERE discordid = ? AND guild = ?", [memberId, guildId])

			// then, get relevant information to send a notification
			const role = await db.get('SELECT roleid FROM Roles WHERE code = ? AND guild = ?', [playerData.team, guildId])
			const teamPlayers = await db.get('SELECT playercount FROM Teams WHERE code = ? AND guild = ?', [playerData.team, guildId])
			const roleObj = await member.guild.roles.fetch(role.roleid)
			const leaveChannel = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guildId);
			// then, get the team logo
			const logo = await db.get('SELECT logo FROM Teams WHERE code = ? AND guild = ?', [playerData.team, guildId]);
			const logoStr = logo.logo;
			const transactionEmbed = new EmbedBuilder()
									.setTitle("Player left!")
									.setThumbnail(logoStr)
									.addFields(
											{name:"Player", value:`${member.user.tag}`},
											{name:"Team", value:`${roleObj}`}
									)
									.setFooter({ text:`Roster size: ${teamPlayers.playercount} / ${maxPlayers.maxplayers}`})
			const channel = await member.guild.channels.fetch(leaveChannel.channelid);
			await channel.send(
				{ embeds: [transactionEmbed]}
			)
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
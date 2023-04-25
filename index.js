const fs = require('node:fs');
const path = require('node:path');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const { getDBConnection } = require('./getDBConnection');
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
		await interaction.deferReply({ ephemeral:true })
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
		if (userRoles.get(highestRole.id)) {
			await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", [user.id, guild])
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
				{name:"Error message", value:`${error}`}
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
		const members = await guild.members.fetch();
		const db = await getDBConnection();
		const guildid = guild.id

		const guildExists = await db.get('SELECT * FROM Leagues WHERE guild = ?', guildid);

		const joinChannel = guild.systemChannel

		try {
			const serverOwner = await guild.members.fetch(guild.ownerId)
			const guildAddChannel = await client.channels.fetch("1095573451999281225")
			const embed = new EmbedBuilder()
				.setTitle("Anarchy has joined a new guild!")
				.setDescription(`Anarchy has joined ${guild.name}! Anarchy is now in ${client.guilds.cache.size} guild!
				\n>>> **Guild ID:** ${guild.id}\n**Server owner:** ${serverOwner.user.tag} (${guild.ownerId})\n**Member count:** ${guild.memberCount}`)
			const invites = await guild.invites.fetch()

			const button = new ActionRowBuilder()
				.addComponents(new ButtonBuilder()
							.setLabel("Join this league!")
							.setStyle(ButtonStyle.Link)
							.setURL(`${invites.first().url}`))
			if (guild.iconURL()) {
				embed.setThumbnail(`${guild.iconURL()}`)
			}
			await guildAddChannel.send({ embeds:[embed], components:[button] })
		} catch(err) {
			console.log(err)
		}

		const embed = new EmbedBuilder()
			.setTitle("Thank you for choosing Anarchy!")
			.setDescription(`Thank you for choosing anarchy, the newest and fastest-growing signing bot on the market.
			\nTo get started, we **highly suggest** running the /setup command, as this will guide you in choosing the core channels (transactions, demands, and game results). After running setup, you're more than free to set extra channels using the /channel command.
			\nAt any time, if you need help getting things to work you're more than free to DM Donovan#3771 or join our support server in order to get assistance debugging.
			\nEnjoy using Anarchy, and good luck with your league!
			\n[Link to our support server](https://discord.gg/TuKy4sPcE8)`)
			.setColor([0, 0, 0])
			.setThumbnail(client.user.avatarURL())

		await joinChannel.send({ embeds:[embed] })


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

		await memberDm.send({ embeds:[embed], components:[button] })
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

					const logo = await db.get('SELECT t.logo FROM Teams t, Roles r WHERE t.code = r.code AND r.roleid = ? AND r.guild = ?', [role, guildId])
					embed
						.setTitle("Player left!")
						.setColor(roleObj.color)
						.setThumbnail(logo.logo)
						.setDescription(`${member.user.tag} has left the ${roleObj} due to leaving the server!
						\n>>> **Roster:** ${roleObj.members.size}/${maxPlayers.maxplayers}`)
					const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guildId);
					if (channelId) {
						const channel = await member.guild.channels.fetch(channelId.channelid);
						await channel.send({ embeds:[embed] })
					}
					// then, check for FO existence
					for (const roleMember of roleObj.members.values()) {
						const roleMemberRoles = roleMember.roles.cache
						if (roleMemberRoles.get(foRole.roleid)) {
							embed.setDescription(`${member.user.tag} has left the ${roleObj.name} in ${member.guild.name} due to leaving the server!\n>>> **Roster:** ${roleObj.members.size}/${maxPlayers.maxplayers}`)
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
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
			await db.run("INSERT INTO Leagues (guild) VALUES (?)", guildid)
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

		// loop thru every role of the member who left
		for (const role of roles.keys()) {
			// then, check to see if the role exists in the db; this usually means we have a team
			const roleInDb = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [role.id, guildId])
			if (roleInDb) {
				// verify that the role we found is actually a team role
				const isTeam = await db.get('SELECT * FROM Teams WHERE code = ? AND guild = ?', [roleInDb.code, guildId])
				const maxPlayers = await db.get('SELECT maxplayers FROM Leagues WHERE guild = ?', guildId)
				if (isTeam) {
					// this means a player left, uh oh!
					// need to find out if the franchise owner was the person who left
					const roleMembers = role.members
					const foRole = await db.get('SELECT * FROM Roles WHERE code = "FO" AND guild = ?', [guildId])
					embed
						.setTitle("Player left!")
						.setColor(role.color)
						.setDescription(`${member.user.tag} has left the ${role}!\n>>> Roster: ${roleMembers.size} / ${maxPlayers.maxplayers}`)
					const channelId = await db.get('SELECT channelid FROM Channels WHERE purpose = "transactions" AND guild = ?', guildId);
					if (channel) {
						const channel = await member.guild.channels.fetch(channelId.channelid);
						await channel.send({ embeds:[embed] })
					}
					// then, check for FO existence
					for (const roleMember of roleMembers.values()) {
						const roleMemberRoles = roleMember.roles.cache
						if (roleMemberRoles.has(foRole)) {
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
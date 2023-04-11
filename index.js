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
		await client.users.fetch(interaction.user.id) // fetch the user and cache them for future use
		await interaction.deferReply({ ephemeral:true })
		await command.execute(interaction);
	} catch (error) {
		await client.users.send("168490999235084288", `**Error for user ${interaction.user.tag} for command ${interaction.commandName} in guild ${interaction.guild.id}**\n\n ${error}`)
		await interaction.editReply({content:`An error has occured! Please DM Donovan#3771 with the following screenshot and explain what happened that caused the error:\n\n${error}`})
		console.error(error);
	}
});

// when the bot joins a guild
client.on(Events.GuildCreate, async guild => {
	const members = await guild.members.fetch();
	const db = await getDBConnection();
	const guildid = guild.id

	const guildExists = await db.get('SELECT * FROM Leagues WHERE guild = ?', guildid);

	if (!guildExists) {
		await db.run("INSERT INTO Leagues (guild, season, offers, filter, maxplayers) VALUES (?, 1, 1, 0, 18)", guildid)
		await db.run("INSERT INTO Admins (discordid, guild) VALUES (?, ?)", ["168490999235084288", guildid])

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
})

// when a member joins
client.on(Events.GuildMemberAdd, async member => {
	// first, check if they are already in the database
	const db = await getDBConnection();
	const memberData = await db.get('SELECT discordid FROM Players WHERE discordid = ? AND guild = ?', [member.id, guild]);

	// if they are not in the database, add them
	if (!memberData) {
		await db.run('INSERT INTO Players (team, discordid, guild, role, contractlength) VALUES ("FA", ?, ? "P", "-1")', [member.id, member.guild.id]);
	}
	await db.close();
})

// when a member leaves
client.on(Events.GuildMemberRemove, async member => {
	const memberId = member.id;
	const guildId = member.guild.id
	const db = await getDBConnection();

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
                .setFooter({ text:`Roster size: ${teamPlayers.playercount} / ${maxPlayers}`})
		const channel = await member.guild.channels.fetch(leaveChannel.channelid);
		channel.send(
			{ embeds: [transactionEmbed]}
		)
	}
	await db.close();
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
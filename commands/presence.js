const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder, SlashCommandSubcommandBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { presenceData, admins } = require('../config.json')

const nameOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName('name')
    .setDescription('The actual status itself')

const typeOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName('type')
    .setDescription("The type of the bot's presence")
    .addChoices(
        {name:"Playing", value:"0"},
        {name:"Listening", value:"2"},
        {name:"Watching", value:"3"},
        {name:"Competing", value:"5"}
    )

const typeSubcommand = new SlashCommandSubcommandBuilder()
        .setName('type')
        .setDescription('The type of presence the bot has.')
        .addStringOption(typeOption);

const nameSubcommand = new SlashCommandSubcommandBuilder()
        .setName('name')
        .setDescription('The name associated with the bots presence, otherwise known as the actual status text itself.')
        .addStringOption(nameOption);


module.exports = {
    data: new SlashCommandBuilder()
        .setName('presence')
        .setDescription('Change the bots presence.')
        .addSubcommand(typeSubcommand)
        .addSubcommand(nameSubcommand),
    async execute(interaction) {
        if (!admins.includes(interaction.user.id)) {
            await db.close();
            return interaction.editReply({ content:"You are not authorized to change the bot's presence!", ephemeral:true });
        }

        let dir = __dirname
        const name = interaction.options.getString("name");
        const type = interaction.options.getString("type");
        let config = await fs.readFile(dir + '/../config.json', 'utf8');
        let configJSON = JSON.parse(config);

        if (name) configJSON.presenceData.activities[0].name = name;
        if (type) configJSON.presenceData.activities[0].type = parseInt(type);

        let newConfig = JSON.stringify(configJSON);

        await fs.writeFile(dir + '/../config.json', newConfig)


        const clientUser = interaction.client.user;
        clientUser.setPresence(configJSON.presenceData)
        return interaction.editReply({ content:"Successfully changed the bot's status!", ephemeral:true });
    }
}
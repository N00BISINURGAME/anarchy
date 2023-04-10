const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption, EmbedBuilder, SlashCommandSubcommandBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { presenceData, admins } = require('../config.json')

const nameOption = new SlashCommandUserOption()
    .setRequired(true)
    .setName('user')
    .setDescription('The person to whitelist')

const fieldOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("role")
    .setDescription("The role you want to whitelist the user for")
    .addChoices(
        {name:"Manager", value:"managers"},
        {name:"Admin", value:"admins"}
    )

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Whitelists a user for a specific role.')
        .addUserOption(nameOption)
        .addStringOption(fieldOption),
    async execute(interaction) {
        if (!admins.includes(interaction.user.id)) {
            return interaction.editReply({ content:"You are not authorized to whitelist people!", ephemeral:true });
        }

        let dir = __dirname
        const name = interaction.options.getUser("user");
        const type = interaction.options.getString("role");
        let config = await fs.readFile(dir + '/../config.json', 'utf8');
        let configJSON = JSON.parse(config);

        if (configJSON[type].includes(name.id)) {
            return interaction.editReply({ content:"This user is already whitelisted!", ephemeral:true });
        }
        configJSON[type].push(name.id)

        let newConfig = JSON.stringify(configJSON);

        await fs.writeFile(dir + '/../config.json', newConfig)


        const clientUser = interaction.client.user;
        clientUser.setPresence(configJSON.presenceData)
        return interaction.editReply({ content:`Successfully whitelisted ${name}!`, ephemeral:true });
    }
}
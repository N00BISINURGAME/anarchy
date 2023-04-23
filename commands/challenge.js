const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const fs = require('fs').promises
const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandRoleOption, SlashCommandIntegerOption, EmbedBuilder } = require('discord.js');
const { getDBConnection } = require('../getDBConnection');
const { admins, managers } = require('../config.json');

const challengingOption = new SlashCommandRoleOption()
    .setRequired(true)
    .setName("challenging")
    .setDescription("The team challenging a rule")

const offendingOption = new SlashCommandRoleOption()
    .setRequired(true)
    .setName("offending")
    .setDescription("The team being accused of violating a rule")

const ruleOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("rule")
    .setDescription("The rule being broken")

const rulingOption = new SlashCommandStringOption()
    .setRequired(true)
    .setName("ruling")
    .setDescription("The ruling being made by the referee")

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Posts a referee decision.')
        .addRoleOption(challengingOption)
        .addRoleOption(offendingOption)
        .addStringOption(ruleOption)
        .addStringOption(rulingOption),
    async execute(interaction) {
        const db = await getDBConnection();

        // first, check to see if the user is authorized to make a ruling
        const user = interaction.user.id;
        const guild = interaction.guild.id
        const challenging = interaction.options.getRole("challenging")
        const offending = interaction.options.getRole("offending")
        const rule = interaction.options.getString("rule")
        const ruling = interaction.options.getString("ruling")

        // check if user is authorized to make ruling
        const authorized = await db.get('SELECT * FROM Managers WHERE discordid = ? AND guild = ?', [user, guild])
        const authorized2 = await db.get('SELECT * FROM Admins WHERE discordid = ? AND guild = ?', [user, guild])
        if (!(authorized || authorized2)) {
          await db.close()
          return interaction.editReply({ content:"You are not authorized to run this command!", ephemeral: true})
        }

        // check if channel has been set
        const channelSql = await db.get('SELECT channelid FROM Channels WHERE purpose = "notices" AND guild = ?', guild)
        if (!channelSql) {
          await db.close()
          return interaction.editReply({ content:"The notices channel has not been set!", ephemeral: true})
        }

        // check if both teams are valid
        const challengingValid = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [challenging.id, guild])
        if (!challengingValid) {
          await db.close()
          return interaction.editReply({ content:`${challenging} is not a valid team`, ephemeral: true})
        }

        // check if both teams are valid
        const offendingValid = await db.get('SELECT * FROM Roles WHERE roleid = ? AND guild = ?', [offending.id, guild])
        if (!offendingValid) {
          await db.close()
          return interaction.editReply({ content:`${offending} is not a valid team`, ephemeral: true})
        }

        const channel = await interaction.guild.channels.fetch(channelSql.channelid)

        const embed = new EmbedBuilder()
          .setTitle("Incoming Referee Decision!")
          .setColor(challenging.color)
          .setDescription(`The ${challenging} are challenging the ${offending}!`)
          .setThumbnail(interaction.guild.iconURL())
          .addFields(
            { name:"Referee", value:`${interaction.member}\n${interaction.user.tag}`},
            { name:"Rule", value:`${rule}`},
            { name:"Ruling", value:`${ruling}`}
          )

        await interaction.editReply({ content:"Successfully posted decision!", ephemeral: true})

        await channel.send({ embeds:[embed] })

        await db.close();
    }
}
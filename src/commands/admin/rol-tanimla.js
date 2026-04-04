const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const queries = require('../../database/queries');
const { parseTime, minutesToLevel, formatDuration } = require('../../utils/timeParser');
const { log, LogTier } = require('../../utils/logger');
const { markLegitimate } = require('../../systems/roleGuard');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('rol-tanimla')
    .setDescription('Seviye rolü tanımla.')
    .addRoleOption(opt => opt.setName('rol').setDescription('Tanımlanacak rol').setRequired(true))
    .addStringOption(opt => opt.setName('ses').setDescription('Gereken ses süresi (ör: 1h, 3g, 1a)').setRequired(false))
    .addStringOption(opt => opt.setName('yazi').setDescription('Gereken yazı süresi (ör: 3g, 1h)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('mod')
        .setDescription('Havuz modu')
        .setRequired(false)
        .addChoices(
          { name: 'Ayrı (her hat bağımsız)', value: 'ayri' },
          { name: 'Birleşik (toplam XP)', value: 'birlesik' },
        )),

  async execute(interaction, client) {
    const role = interaction.options.getRole('rol');
    const sesStr = interaction.options.getString('ses');
    const yaziStr = interaction.options.getString('yazi');
    const mod = interaction.options.getString('mod') || 'ayri';

    const sesSure = sesStr ? parseTime(sesStr) : 0;
    const yaziSure = yaziStr ? parseTime(yaziStr) : 0;

    if (sesStr && sesSure === null) {
      return interaction.reply({ content: '❌ Geçersiz ses süresi formatı. Örnek: `1h 3g`, `2a`', ephemeral: true });
    }
    if (yaziStr && yaziSure === null) {
      return interaction.reply({ content: '❌ Geçersiz yazı süresi formatı. Örnek: `1h 3g`, `2a`', ephemeral: true });
    }

    const sesLevel = minutesToLevel(sesSure || 0);
    const yaziLevel = minutesToLevel(yaziSure || 0);
    const isStarter = sesLevel === 0 && yaziLevel === 0;

    await queries.addLevelRole(
      interaction.guild.id, role.id, role.name,
      sesSure || 0, yaziSure || 0, sesLevel, yaziLevel, mod,
    );

    markLegitimate(interaction.guild.id, role.id);

    const embed = new EmbedBuilder()
      .setColor(config.colors.operational)
      .setTitle('✅ Rol Tanımlandı')
      .setDescription(isStarter
        ? `${role} **başlangıç rolü** olarak tanımlandı. Tüm yeni üyelere atanacak.`
        : `${role} seviye rolü olarak tanımlandı.`)
      .addFields(
        { name: '🎙️ Ses Süresi', value: sesSure ? formatDuration(sesSure) : 'Yok', inline: true },
        { name: '📝 Yazı Süresi', value: yaziSure ? formatDuration(yaziSure) : 'Yok', inline: true },
        { name: '📊 Mod', value: mod === 'birlesik' ? 'Birleşik' : 'Ayrı', inline: true },
        { name: '🎙️ Ses Seviyesi', value: `${sesLevel}`, inline: true },
        { name: '📝 Yazı Seviyesi', value: `${yaziLevel}`, inline: true },
      )
      .setFooter({ text: 'Evil Mega Corp // Rol Tanımlama' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    log(client, interaction.guild.id, LogTier.OPERATIONAL, {
      title: 'Rol Tanımlandı',
      description: `${role.name} seviye rolü tanımlandı.`,
      operatorId: interaction.user.id,
      roleId: role.id,
      fields: [
        { name: 'Ses Süresi', value: sesSure ? formatDuration(sesSure) : 'Yok', inline: true },
        { name: 'Yazı Süresi', value: yaziSure ? formatDuration(yaziSure) : 'Yok', inline: true },
        { name: 'Mod', value: mod, inline: true },
      ],
    });
  },
};

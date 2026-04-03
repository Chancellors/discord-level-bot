const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('departman-rol')
    .setDescription('Seviye rollerini yönetin.')
    .addSubcommand(sub =>
      sub.setName('ata')
        .setDescription('Bir seviyeye rol ata.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Seviye numarası').setRequired(true).setMinValue(1))
        .addRoleOption(opt => opt.setName('rol').setDescription('Atanacak rol').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('sema')
        .setDescription('Tüm seviye rollerinin şemasını gösterir.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(false).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
    )
    .addSubcommand(sub =>
      sub.setName('ihrac')
        .setDescription('Bir seviyedeki rolü kaldır.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Kaldırılacak seviye').setRequired(true).setMinValue(1))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) {
      guildData = await Guild.create({ guildId });
    }

    if (sub === 'ata') {
      const hat = interaction.options.getString('hat');
      const seviye = interaction.options.getInteger('seviye');
      const rol = interaction.options.getRole('rol');

      const field = hat === 'text' ? 'levelRolesText' : 'levelRolesVoice';

      // Ayni seviyede zaten rol var mi?
      const existing = guildData[field].find(r => r.level === seviye);
      if (existing) {
        // Guncelle
        existing.roleId = rol.id;
        existing.name = rol.name;
      } else {
        guildData[field].push({ level: seviye, roleId: rol.id, name: rol.name });
      }

      // Seviyeye gore sirala
      guildData[field].sort((a, b) => a.level - b.level);
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Departman Rol Atandı',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Seviye', value: `${seviye}`, inline: true },
        ],
      });

      return interaction.reply({
        content: `✅ **${rol.name}** rolü, ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı **Lv.${seviye}** için atandı.`,
        ephemeral: true,
      });
    }

    if (sub === 'sema') {
      const hat = interaction.options.getString('hat');

      const buildSchema = (roles, title) => {
        if (!roles.length) return `**${title}:** Henüz rol tanımlı değil.`;
        return `**${title}:**\n` + roles.map(r => {
          const role = interaction.guild.roles.cache.get(r.roleId);
          return `Lv.**${r.level}** → ${role ? role.toString() : `\`${r.roleId}\` (Silinmiş?)`}`;
        }).join('\n');
      };

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📊 Evil Mega Corp // Departman Rol Şeması')
        .setTimestamp()
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' });

      if (!hat || hat === 'text') {
        embed.addFields({ name: '📝 Yazı Hattı', value: buildSchema(guildData.levelRolesText, 'Yazı'), inline: false });
      }
      if (!hat || hat === 'voice') {
        embed.addFields({ name: '🎙️ Ses Hattı', value: buildSchema(guildData.levelRolesVoice, 'Ses'), inline: false });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ihrac') {
      const hat = interaction.options.getString('hat');
      const seviye = interaction.options.getInteger('seviye');
      const field = hat === 'text' ? 'levelRolesText' : 'levelRolesVoice';

      const index = guildData[field].findIndex(r => r.level === seviye);
      if (index === -1) {
        return interaction.reply({ content: `❌ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı Lv.${seviye} için tanımlı rol bulunamadı.`, ephemeral: true });
      }

      const removed = guildData[field].splice(index, 1)[0];
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Departman Rol İhraç Edildi',
        operatorId: interaction.user.id,
        roleId: removed.roleId,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Seviye', value: `${seviye}`, inline: true },
        ],
      });

      return interaction.reply({
        content: `✅ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı **Lv.${seviye}** rolü kaldırıldı.`,
        ephemeral: true,
      });
    }
  },
};

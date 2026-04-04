const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const { parseTime, formatDuration } = require('../../utils/timeParser');
const { log, LogTier } = require('../../utils/logger');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('etkinlik')
    .setDescription('XP etkinlik çarpanı yönetimi.')
    .addSubcommand(sub =>
      sub.setName('baslat')
        .setDescription('XP etkinlik çarpanı başlat.')
        .addNumberOption(opt => opt.setName('carpan').setDescription('XP çarpanı (1.1-10)').setRequired(true).setMinValue(1.1).setMaxValue(10))
        .addStringOption(opt => opt.setName('sure').setDescription('Etkinlik süresi (ör: 3g, 1h, 12s)').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('durdur')
        .setDescription('Aktif etkinliği durdur.'))
    .addSubcommand(sub =>
      sub.setName('durum')
        .setDescription('Mevcut etkinlik durumunu göster.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildData = await cache.getGuild(guildId);

    if (sub === 'baslat') {
      const carpan = interaction.options.getNumber('carpan');
      const sureStr = interaction.options.getString('sure');
      const minutes = parseTime(sureStr);

      if (minutes === null) {
        return interaction.reply({ content: '❌ Geçersiz süre formatı. Örnek: `3g`, `1h 2g`, `12s`', ephemeral: true });
      }

      const bitis = new Date(Date.now() + minutes * 60000).toISOString();

      guildData.etkinlik_carpani = carpan;
      guildData.etkinlik_bitisi = bitis;
      cache.setGuild(guildId, guildData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle('🎉 Etkinlik Başlatıldı!')
        .setDescription(`XP çarpanı **${carpan}x** olarak ayarlandı.`)
        .addFields(
          { name: '⏱️ Süre', value: formatDuration(minutes), inline: true },
          { name: '📅 Bitiş', value: `<t:${Math.floor(new Date(bitis).getTime() / 1000)}:F>`, inline: true },
          { name: '🔢 Çarpan', value: `${carpan}x`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Etkinlik' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Etkinlik Başlatıldı',
        description: `${carpan}x çarpan, ${formatDuration(minutes)} süre.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'durdur') {
      guildData.etkinlik_carpani = 1.0;
      guildData.etkinlik_bitisi = null;
      cache.setGuild(guildId, guildData);

      await interaction.reply({ content: '✅ Etkinlik durduruldu. Çarpan **1.0x** olarak sıfırlandı.', ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Etkinlik Durduruldu',
        description: 'XP çarpanı 1.0x olarak sıfırlandı.',
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'durum') {
      const carpan = guildData.etkinlik_carpani ?? 1.0;
      const bitis = guildData.etkinlik_bitisi;
      const aktif = carpan > 1.0 && bitis && new Date(bitis) > new Date();

      const embed = new EmbedBuilder()
        .setColor(aktif ? config.colors.operational : config.colors.info)
        .setTitle('📊 Evil Mega Corp // Etkinlik Durumu')
        .addFields(
          { name: '📌 Durum', value: aktif ? '🟢 Aktif' : '🔴 Pasif', inline: true },
          { name: '🔢 Çarpan', value: `${carpan}x`, inline: true },
          { name: '📅 Bitiş', value: aktif ? `<t:${Math.floor(new Date(bitis).getTime() / 1000)}:R>` : 'Yok', inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Etkinlik' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

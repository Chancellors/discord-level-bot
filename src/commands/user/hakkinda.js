const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const config = require('../../config');
const os = require('os');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('hakkinda')
    .setDescription('Evil Mega Corp botu ve sistem detayları hakkında bilgi verir.')
    .addStringOption(opt =>
      opt.setName('bolum')
        .setDescription('Belirli bir bilgi bölümü göster')
        .setRequired(false)
        .addChoices(
          { name: 'Genel Bilgi', value: 'genel' },
          { name: 'Sistem Durumu', value: 'sistem' },
          { name: 'Sunucu İstatistikleri', value: 'sunucu' }
        )
    ),

  async execute(interaction, client) {
    const bolum = interaction.options.getString('bolum') || 'genel';

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const ping = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
      .setTimestamp()
      .setFooter({ text: 'Evil Mega Corp // Surveillance & Authority Division' });

    if (bolum === 'genel') {
      embed
        .setTitle('🏢 Evil Mega Corp // Sistem Botu')
        .setDescription(
          `**Evil Mega Corp**, gelişmiş seviye yönetimi, otomatik rol koruması ve kurumsal prestij sistemi ile donatılmış özel bir Discord sistem botudur.\n\n` +
          `Bu bot, sunucudaki hiyerarşiyi korumak, personel ilerlemesini takip etmek ve tüm operasyonları şeffaf bir şekilde denetlemek için tasarlanmıştır.`
        )
        .addFields(
          {
            name: '⚡ Temel Özellikler',
            value: [
              '• **Çift Hat Sistemi:** Yazı ve Ses seviyeleri tamamen bağımsız',
              '• **Self-Healing:** Yetkisiz rol müdahalelerini otomatik geri alır',
              '• **Living Cards:** Dinamik seviye kartları ve prestij mühürleri',
              '• **Mutlak Gözetim:** 4 katmanlı loglama sistemi',
              '• **Dinamik Klerans:** Bot içi yetki delegasyonu',
              '• **Vergi Sistemi:** AFK ve pasiflik cezaları',
              '• **Anti-Spam:** Mesaj ve ses kanalı manipülasyonu tespiti',
              '• **12 Tema:** Seviye bazlı açılan kart temaları',
            ].join('\n'),
            inline: false,
          },
          {
            name: '🛠️ Teknik Bilgi',
            value: [
              `**Motor:** Discord.js v${version}`,
              '**Veri Tabanı:** MongoDB (Mongoose)',
              '**Görsel:** Canvas',
              '**XP Formülü:** 5L² + 50L + 100',
              `**Komut Sayısı:** ${client.commands.size}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📡 Canlı Durum',
            value: [
              `**Çalışma Süresi:** ${hours}s ${minutes}dk ${seconds}sn`,
              `**Ping:** ${ping}ms`,
              `**Sunucu Sayısı:** ${client.guilds.cache.size}`,
            ].join('\n'),
            inline: true,
          }
        );
    }

    if (bolum === 'sistem') {
      const dbStatus = mongoose.connection.readyState;
      const dbStatusText = { 0: '❌ Bağlantı Yok', 1: '✅ Bağlı', 2: '🔄 Bağlanıyor', 3: '⚠️ Bağlantı Kesiliyor' };
      const memUsage = process.memoryUsage();

      embed
        .setTitle('⚙️ Evil Mega Corp // Sistem Durumu')
        .addFields(
          {
            name: '💻 Sunucu Bilgileri',
            value: [
              `**İşletim Sistemi:** ${os.platform()} ${os.release()}`,
              `**Node.js:** ${process.version}`,
              `**Discord.js:** v${version}`,
              `**CPU:** ${os.cpus()[0]?.model || 'Bilinmiyor'}`,
              `**CPU Çekirdek:** ${os.cpus().length}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📊 Kaynak Kullanımı',
            value: [
              `**RAM Kullanımı:** ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
              `**Toplam RAM:** ${Math.round(os.totalmem() / 1024 / 1024)}MB`,
              `**Çalışma Süresi:** ${hours}s ${minutes}dk ${seconds}sn`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🗄️ Veri Tabanı',
            value: [
              `**Durum:** ${dbStatusText[dbStatus] || '❓ Bilinmiyor'}`,
              `**Ping:** ${ping}ms`,
              `**Motor:** MongoDB + Mongoose`,
            ].join('\n'),
            inline: false,
          }
        );
    }

    if (bolum === 'sunucu') {
      const guildData = await Guild.findOne({ guildId: interaction.guild.id });
      const totalUsers = await User.countDocuments({ guildId: interaction.guild.id });
      const frozenUsers = await User.countDocuments({ guildId: interaction.guild.id, frozen: true });
      const activeUsers = await User.countDocuments({
        guildId: interaction.guild.id,
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      const textRoleCount = guildData?.levelRolesText?.length || 0;
      const voiceRoleCount = guildData?.levelRolesVoice?.length || 0;
      const multiplier = guildData?.xpMultiplier || 1.0;

      embed
        .setTitle('📊 Evil Mega Corp // Sunucu İstatistikleri')
        .addFields(
          {
            name: '👥 Personel Durumu',
            value: [
              `**Kayıtlı Personel:** ${totalUsers}`,
              `**Aktif (7 gün):** ${activeUsers}`,
              `**Dondurulmuş:** ${frozenUsers}`,
              `**Sunucu Üye Sayısı:** ${interaction.guild.memberCount}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🏢 Departman Yapısı',
            value: [
              `**Yazı Hattı Rolleri:** ${textRoleCount} kademe`,
              `**Ses Hattı Rolleri:** ${voiceRoleCount} kademe`,
              `**Başlangıç Rolleri:** ${guildData?.startingRoles?.length || 0}`,
              `**Kara Liste Kanalı:** ${guildData?.blacklistedChannels?.length || 0}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚡ Aktif Ayarlar',
            value: [
              `**XP Çarpanı:** x${multiplier}`,
              `**Bildirimler:** ${guildData?.notificationsEnabled !== false ? '✅ Açık' : '❌ Kapalı'}`,
              `**Anti-Spam:** ${guildData?.antiSpam?.enabled !== false ? '✅ Açık' : '❌ Kapalı'}`,
              `**Log Kanalı:** ${guildData?.logChannel ? `<#${guildData.logChannel}>` : '❌ Ayarlanmamış'}`,
              `**Bildirim Kanalı:** ${guildData?.notificationChannel ? `<#${guildData.notificationChannel}>` : '❌ Ayarlanmamış'}`,
            ].join('\n'),
            inline: false,
          }
        );
    }

    await interaction.reply({ embeds: [embed] });
  },
};

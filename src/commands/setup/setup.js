const { SlashCommandBuilder, EmbedBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Evil Mega Corp kurulum sihirbazı.')
    .addSubcommand(sub => sub.setName('baslat').setDescription('Kurulum sihirbazını başlat.'))
    .addSubcommand(sub =>
      sub.setName('hizli')
        .setDescription('Tüm kanalları tek komutla ayarla.')
        .addChannelOption(opt => opt.setName('log').setDescription('Log kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addChannelOption(opt => opt.setName('bildirim').setDescription('Bildirim kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addChannelOption(opt => opt.setName('hosgeldin').setDescription('Hoş geldin kanalı').setRequired(false).addChannelTypes(ChannelType.GuildText))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'hizli') {
      const logCh = interaction.options.getChannel('log');
      const notifCh = interaction.options.getChannel('bildirim');
      const welcomeCh = interaction.options.getChannel('hosgeldin');

      const guildData = await cache.getGuild(interaction.guild.id);
      guildData.log_channel = logCh.id;
      guildData.notification_channel = notifCh.id;
      guildData.notifications_enabled = true;

      if (welcomeCh) {
        guildData.welcome_channel = welcomeCh.id;
        guildData.welcome_enabled = true;
      }

      cache.setGuild(interaction.guild.id, guildData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.prestige)
        .setTitle('✅ Evil Mega Corp // Kurulum Tamamlandı')
        .addFields(
          { name: '📋 Log Kanalı', value: `${logCh}`, inline: true },
          { name: '📢 Bildirim Kanalı', value: `${notifCh}`, inline: true },
          { name: '👋 Hoş Geldin Kanalı', value: welcomeCh ? `${welcomeCh}` : 'Ayarlanmadı', inline: true },
        )
        .setDescription('Temel ayarlar yapıldı. Şimdi `/rol-tanımla` ile seviye rollerini tanımlayın.')
        .setFooter({ text: 'Evil Mega Corp // Setup Complete' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'baslat') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.prestige)
        .setTitle('🏢 Evil Mega Corp // Kurulum Sihirbazı')
        .setDescription([
          '**Evil Mega Corp Seviye ve Üye İzleme Sistemi**\'ne hoş geldiniz!',
          '',
          '**Kurulum Adımları:**',
          '1️⃣ `/setup hizli` — Log, bildirim ve hoş geldin kanallarını tek komutla ayarlayın',
          '2️⃣ `/rol-tanımla` — Seviye rollerini süre bazlı tanımlayın',
          '3️⃣ `/karsilayici` — Hoş geldin ve ayrılma mesajlarını özelleştirin',
          '4️⃣ `/ayar` — XP çarpanı, kara listeler ve diğer ayarları yapılandırın',
          '',
          '**Örnek Rol Tanımlama:**',
          '```',
          '/rol-tanımla rol:@Çaylak ses:0 yazı:0           → Başlangıç rolü',
          '/rol-tanımla rol:@Üye ses:1h yazı:3g            → 1 hafta ses veya 3 gün yazı',
          '/rol-tanımla rol:@Kıdemli ses:1a yazı:2h mod:birlesik → Birleşik havuz',
          '```',
          '',
          '**XP Sistemi:**',
          '🎙️ Ses: **15 XP/dakika** | 📝 Yazı: **5 XP/kelime** | 📊 **100 XP = 1 Seviye**',
          '',
          '**Çarpanlar:**',
          '🌙 Gece (00:00-08:00): **×2** | 🎥 Kamera/Yayın: **×1.2** | 📡 Etkinlik: **×N**',
        ].join('\n'))
        .setFooter({ text: 'Evil Mega Corp // Kurulum Rehberi' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

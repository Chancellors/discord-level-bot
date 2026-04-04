const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const { log, LogTier } = require('../../utils/logger');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('ayar')
    .setDescription('Sunucu ayarlarını yapılandır.')
    .addSubcommand(sub =>
      sub.setName('log-kanal')
        .setDescription('Log kanalını ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Log kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('bildirim-kanal')
        .setDescription('Bildirim kanalını ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Bildirim kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('anti-spam')
        .setDescription('Anti-spam sistemini aç/kapat.')
        .addBooleanOption(opt => opt.setName('durum').setDescription('Aktif mi?').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ses-min-kullanici')
        .setDescription('Ses XP için minimum kullanıcı sayısı.')
        .addIntegerOption(opt => opt.setName('sayi').setDescription('Minimum kullanıcı (1-10)').setRequired(true).setMinValue(1).setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('afk-xp')
        .setDescription('AFK kullanıcılara XP verilsin mi?')
        .addBooleanOption(opt => opt.setName('durum').setDescription('İzin ver?').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('xp-bildirim')
        .setDescription('Seviye atlama bildirimlerini aç/kapat.')
        .addBooleanOption(opt => opt.setName('durum').setDescription('Aktif mi?').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('bildirim-sablonu-ses')
        .setDescription('Ses seviye atlama bildirim şablonunu ayarla.')
        .addStringOption(opt => opt.setName('sablon').setDescription('Şablon metni').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('bildirim-sablonu-yazi')
        .setDescription('Yazı seviye atlama bildirim şablonunu ayarla.')
        .addStringOption(opt => opt.setName('sablon').setDescription('Şablon metni').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('goster')
        .setDescription('Mevcut tüm ayarları göster.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildData = await cache.getGuild(interaction.guild.id);

    if (sub === 'log-kanal') {
      const ch = interaction.options.getChannel('kanal');
      guildData.log_channel = ch.id;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Log kanalı ${ch} olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'bildirim-kanal') {
      const ch = interaction.options.getChannel('kanal');
      guildData.notification_channel = ch.id;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Bildirim kanalı ${ch} olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'anti-spam') {
      const durum = interaction.options.getBoolean('durum');
      guildData.anti_spam_enabled = durum;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Anti-spam sistemi **${durum ? 'aktif' : 'devre dışı'}**.`, ephemeral: true });
    }

    if (sub === 'ses-min-kullanici') {
      const sayi = interaction.options.getInteger('sayi');
      guildData.voice_min_users = sayi;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Ses XP için minimum kullanıcı sayısı **${sayi}** olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'afk-xp') {
      const durum = interaction.options.getBoolean('durum');
      guildData.voice_afk_xp_allowed = durum;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ AFK XP **${durum ? 'aktif' : 'devre dışı'}**.`, ephemeral: true });
    }

    if (sub === 'xp-bildirim') {
      const durum = interaction.options.getBoolean('durum');
      guildData.notifications_enabled = durum;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Seviye bildirimler **${durum ? 'aktif' : 'devre dışı'}**.`, ephemeral: true });
    }

    if (sub === 'bildirim-sablonu-ses') {
      const sablon = interaction.options.getString('sablon');
      guildData.notification_template_voice = sablon;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Ses bildirim şablonu güncellendi:\n\`${sablon}\``, ephemeral: true });
    }

    if (sub === 'bildirim-sablonu-yazi') {
      const sablon = interaction.options.getString('sablon');
      guildData.notification_template_text = sablon;
      cache.setGuild(interaction.guild.id, guildData);
      return interaction.reply({ content: `✅ Yazı bildirim şablonu güncellendi:\n\`${sablon}\``, ephemeral: true });
    }

    if (sub === 'goster') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('⚙️ Evil Mega Corp // Sunucu Ayarları')
        .addFields(
          { name: '📋 Log Kanalı', value: guildData.log_channel ? `<#${guildData.log_channel}>` : 'Ayarlanmadı', inline: true },
          { name: '📢 Bildirim Kanalı', value: guildData.notification_channel ? `<#${guildData.notification_channel}>` : 'Ayarlanmadı', inline: true },
          { name: '📢 Bildirimler', value: guildData.notifications_enabled ? 'Aktif' : 'Devre dışı', inline: true },
          { name: '🛡️ Anti-Spam', value: guildData.anti_spam_enabled ? 'Aktif' : 'Devre dışı', inline: true },
          { name: '🔇 Ses Min. Kullanıcı', value: `${guildData.voice_min_users ?? 1}`, inline: true },
          { name: '💤 AFK XP', value: guildData.voice_afk_xp_allowed ? 'İzinli' : 'Yasak', inline: true },
          { name: '📨 Spam Mesaj Limiti', value: `${guildData.anti_spam_max_messages ?? 'Ayarlanmadı'}`, inline: true },
          { name: '🔀 Ses Hop Limiti', value: `${guildData.anti_spam_voice_hop_limit ?? 'Ayarlanmadı'}`, inline: true },
          { name: '🎙️ Ses Bildirim Şablonu', value: guildData.notification_template_voice || 'Varsayılan', inline: false },
          { name: '📝 Yazı Bildirim Şablonu', value: guildData.notification_template_text || 'Varsayılan', inline: false },
          { name: '🎉 Etkinlik Çarpanı', value: `${guildData.etkinlik_carpani ?? 1.0}x`, inline: true },
          { name: '👋 Hoş Geldin', value: guildData.welcome_enabled ? 'Aktif' : 'Devre dışı', inline: true },
          { name: '👋 Ayrılma', value: guildData.leave_enabled ? 'Aktif' : 'Devre dışı', inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Ayarlar' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

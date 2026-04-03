const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('hakkinda')
    .setDescription('Evil Mega Corp botu ve sistem detayları hakkında bilgi verir.'),

  async execute(interaction, client) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const memberCount = interaction.guild.memberCount;
    const guildCount = client.guilds.cache.size;

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
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
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 Sistem Durumu',
          value: [
            `**Çalışma Süresi:** ${hours}s ${minutes}dk ${seconds}sn`,
            `**Sunucu Sayısı:** ${guildCount}`,
            `**Personel Sayısı:** ${memberCount}`,
            `**Komut Sayısı:** ${client.commands.size}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🛠️ Teknik Bilgi',
          value: [
            '**Motor:** Discord.js v14',
            '**Veri Tabanı:** MongoDB',
            '**Görsel:** Canvas',
            `**XP Formülü:** 5L² + 50L + 100`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({ text: 'Evil Mega Corp // Surveillance & Authority Division' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

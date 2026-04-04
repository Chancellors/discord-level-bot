const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('bildirim')
    .setDescription('Seviye atlama DM bildirim tercihlerini yonet.')
    .addSubcommand(sub => sub.setName('ac').setDescription('DM bildirimlerini ac.'))
    .addSubcommand(sub => sub.setName('kapat').setDescription('DM bildirimlerini kapat.'))
    .addSubcommand(sub => sub.setName('durum').setDescription('Mevcut bildirim durumunu goster.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const userData = await cache.getUser(userId, guildId);
    if (!userData) {
      return interaction.reply({ content: 'Kullanici verisi bulunamadi.', ephemeral: true });
    }

    if (sub === 'ac') {
      userData.dm_notifications = true;
      cache.setUser(userId, guildId, userData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.personnel)
        .setTitle('Bildirimler Acildi')
        .setDescription('Seviye atladiginizda DM ile bilgilendirileceksiniz.')
        .setFooter({ text: 'Evil Mega Corp // Bildirim Sistemi' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'kapat') {
      userData.dm_notifications = false;
      cache.setUser(userId, guildId, userData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.security)
        .setTitle('Bildirimler Kapatildi')
        .setDescription('Artik DM ile bildirim almayacaksiniz.')
        .setFooter({ text: 'Evil Mega Corp // Bildirim Sistemi' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'durum') {
      const enabled = userData.dm_notifications !== false;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Bildirim Durumu')
        .setDescription(`DM Bildirimleri: **${enabled ? 'Acik' : 'Kapali'}**`)
        .setFooter({ text: 'Evil Mega Corp // Bildirim Sistemi' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

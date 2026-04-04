const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('hakkinda')
    .setDescription('Bot hakkinda bilgi goster.'),

  async execute(interaction, client) {
    const uptime = formatUptime(client.uptime);
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
      .setTitle('Evil Mega Corp // Sistem Raporu')
      .setDescription(
        'Kurumsal gozetim ve personel izleme sistemi. ' +
        'Ses ve yazi aktivitelerini takip ederek personelin sirket ici yukselmesini yonetir.'
      )
      .addFields(
        { name: 'Versiyon', value: '`2.0.0`', inline: true },
        { name: 'Sunucu Sayisi', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Toplam Personel', value: `${totalUsers.toLocaleString('tr-TR')}`, inline: true },
        { name: 'Calisma Suresi', value: uptime, inline: true },
        { name: 'Bellek Kullanimi', value: `${memUsage} MB`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'discord.js', value: `v${djsVersion}`, inline: true },
      )
      .setFooter({ text: 'Evil Mega Corp // Her sey kayit altinda.' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}g`);
  if (hours > 0) parts.push(`${hours}s`);
  if (minutes > 0) parts.push(`${minutes}dk`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}sn`);
  return parts.join(' ');
}

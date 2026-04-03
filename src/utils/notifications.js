const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');
const config = require('../config');

/**
 * Seviye atlama bildirimi gonder
 */
async function sendLevelUp(client, guildId, user, type, oldLevel, newLevel, oldRole, newRole) {
  try {
    const guildData = await Guild.findOne({ guildId });
    if (!guildData?.notificationChannel) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(guildData.notificationChannel);
    if (!channel) return;

    const template = type === 'text'
      ? guildData.notificationTemplateText
      : guildData.notificationTemplateVoice;

    const message = template
      .replace(/{user}/g, `<@${user.id}>`)
      .replace(/{oldLevel}/g, oldLevel)
      .replace(/{newLevel}/g, newLevel)
      .replace(/{oldRole}/g, oldRole || 'Yok')
      .replace(/{newRole}/g, newRole || 'Yok');

    const hatTipi = type === 'text' ? 'Yazı Hattı' : 'Ses Hattı';

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
      .setTitle(`📊 Evil Mega Corp // Üye / Prestij – ${hatTipi} Güncellemesi`)
      .setDescription(message)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
      .setTimestamp()
      .setFooter({ text: 'Evil Mega Corp // Surveillance Division' });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Notification] Bildirim gonderilemedi:', err.message);
  }
}

module.exports = { sendLevelUp };

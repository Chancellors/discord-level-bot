const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const cache = require('../cache/manager');

/**
 * Send a level-up notification to the guild's notification channel and optionally DM the user.
 *
 * @param {Client} client - Discord client
 * @param {string} guildId - Guild ID
 * @param {User|object} user - Discord user (must have .id and .toString())
 * @param {string} hat - 'ses', 'yazi', or 'birlesik'
 * @param {number} oldLevel - Previous level
 * @param {number} newLevel - New level
 * @param {string|null} oldRole - Previous role name or mention
 * @param {string|null} newRole - New role name or mention
 */
async function sendLevelUp(client, guildId, user, hat, oldLevel, newLevel, oldRole, newRole) {
  try {
    const guild = await cache.getGuild(guildId);
    if (!guild || !guild.notifications_enabled) return;
    if (!guild.notification_channel) return;

    // Pick the right template based on hat
    let template;
    if (hat === 'ses') {
      template = guild.notification_template_voice || '🎙️ {user} ses seviyesi atladı! **{oldLevel}** → **{newLevel}**';
    } else if (hat === 'yazi') {
      template = guild.notification_template_text || '✍️ {user} yazı seviyesi atladı! **{oldLevel}** → **{newLevel}**';
    } else {
      // birlesik: use voice template as default fallback
      template = guild.notification_template_voice || '⭐ {user} seviye atladı! **{oldLevel}** → **{newLevel}**';
    }

    // Replace template variables
    const message = template
      .replace(/\{user\}/g, `<@${user.id}>`)
      .replace(/\{oldLevel\}/g, String(oldLevel))
      .replace(/\{newLevel\}/g, String(newLevel))
      .replace(/\{oldRole\}/g, oldRole || 'Yok')
      .replace(/\{newRole\}/g, newRole || 'Yok');

    const hatLabel = hat === 'ses' ? 'Ses' : hat === 'yazi' ? 'Yazı' : 'Birleşik';

    const embed = new EmbedBuilder()
      .setTitle('Seviye Atlama!')
      .setDescription(message)
      .setColor(config.colors.info)
      .addFields(
        { name: 'Hat', value: hatLabel, inline: true },
        { name: 'Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Evil Mega Corp // Seviye Sistemi' });

    if (oldRole || newRole) {
      embed.addFields({
        name: 'Rol Değişimi',
        value: `${oldRole || 'Yok'} → ${newRole || 'Yok'}`,
        inline: true,
      });
    }

    // Send to notification channel
    const channel = await client.channels.fetch(guild.notification_channel).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }

    // DM notification if user prefers it
    const userData = await cache.getUser(user.id, guildId);
    if (userData && userData.dm_notifications) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('Seviye Atlama!')
          .setDescription(message)
          .setColor(config.colors.info)
          .addFields(
            { name: 'Hat', value: hatLabel, inline: true },
            { name: 'Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
          )
          .setTimestamp()
          .setFooter({ text: 'Evil Mega Corp // Seviye Sistemi' });

        await user.send({ embeds: [dmEmbed] });
      } catch (_) {
        // DMs closed or failed — silently continue
      }
    }
  } catch (err) {
    console.error(`[Notifications] Failed to send level-up for guild ${guildId}:`, err.message);
  }
}

module.exports = {
  sendLevelUp,
};

const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const cache = require('../cache/manager');

// ─── Log Tiers ─────────────────────────────────────────────────────────────────

const LogTier = {
  PERSONNEL: { name: 'Personel', color: config.colors.personnel },
  OPERATIONAL: { name: 'Operasyonel', color: config.colors.operational },
  SECURITY: { name: 'Güvenlik', color: config.colors.security },
  SHADOW: { name: 'Gölge', color: config.colors.shadow },
};

/**
 * Send a formatted log embed to the guild's log channel.
 *
 * @param {Client} client - Discord client
 * @param {string} guildId - Guild ID
 * @param {object} tier - LogTier value
 * @param {object} data - Log data
 * @param {string} data.title - Embed title
 * @param {string} [data.description] - Embed description
 * @param {string} [data.operatorId] - User who performed the action
 * @param {string} [data.targetId] - Target user
 * @param {string} [data.roleId] - Related role
 * @param {string} [data.channelId] - Related channel
 * @param {Array}  [data.fields] - Additional embed fields [{name, value, inline}]
 */
async function log(client, guildId, tier, data) {
  try {
    // Ghost mode check: skip logging for ghost operators
    if (data.operatorId && client.ghostMode && client.ghostMode.has(data.operatorId)) {
      return;
    }

    const guild = await cache.getGuild(guildId);
    if (!guild || !guild.log_channel) return;

    const channel = await client.channels.fetch(guild.log_channel).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(data.title || 'Log')
      .setColor(tier.color)
      .setTimestamp()
      .setFooter({ text: `Evil Mega Corp // ${tier.name}` });

    if (data.description) {
      embed.setDescription(data.description);
    }

    // Standard fields
    const fields = [];

    if (data.operatorId) {
      fields.push({ name: 'Operatör', value: `<@${data.operatorId}>`, inline: true });
    }

    if (data.targetId) {
      fields.push({ name: 'Hedef', value: `<@${data.targetId}>`, inline: true });
    }

    if (data.roleId) {
      fields.push({ name: 'Rol', value: `<@&${data.roleId}>`, inline: true });
    }

    if (data.channelId) {
      fields.push({ name: 'Kanal', value: `<#${data.channelId}>`, inline: true });
    }

    // Custom fields
    if (data.fields && Array.isArray(data.fields)) {
      for (const field of data.fields) {
        fields.push({
          name: field.name,
          value: String(field.value),
          inline: field.inline !== undefined ? field.inline : false,
        });
      }
    }

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[Logger] Failed to send log to guild ${guildId}:`, err.message);
  }
}

module.exports = {
  LogTier,
  log,
};

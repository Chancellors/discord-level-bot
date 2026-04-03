const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const Guild = require('../models/Guild');

// Log Katmanlari
const LogTier = {
  PERSONNEL: 'personnel',   // Yesil/Mavi - Personel hareket
  OPERATIONAL: 'operational', // Sari/Turuncu - Admin islemleri
  SECURITY: 'security',      // Kirmizi - Guvenlik ihlalleri
  SHADOW: 'shadow',          // Mor - Gelistirici
};

const tierColors = {
  [LogTier.PERSONNEL]: 0x2ecc71,
  [LogTier.OPERATIONAL]: 0xf39c12,
  [LogTier.SECURITY]: 0xe74c3c,
  [LogTier.SHADOW]: 0x9b59b6,
};

const tierEmojis = {
  [LogTier.PERSONNEL]: '📋',
  [LogTier.OPERATIONAL]: '⚙️',
  [LogTier.SECURITY]: '🚨',
  [LogTier.SHADOW]: '👻',
};

/**
 * Loglama fonksiyonu - 4 katmanli sistem
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} tier - LogTier enum degeri
 * @param {object} data - { title, description, fields[], operatorId, targetId, roleId, channelId }
 */
async function log(client, guildId, tier, data) {
  try {
    const guildData = await Guild.findOne({ guildId });
    if (!guildData?.logChannel) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(guildData.logChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(tierColors[tier] || config.colors.info)
      .setTitle(`${tierEmojis[tier] || '📌'} ${data.title}`)
      .setDescription(data.description || '')
      .setTimestamp()
      .setFooter({ text: `Evil Mega Corp // ${tier.toUpperCase()} LOG` });

    // Standart meta alanlar
    const metaFields = [];
    if (data.operatorId) metaFields.push({ name: 'Operator', value: `<@${data.operatorId}> (\`${data.operatorId}\`)`, inline: true });
    if (data.targetId) metaFields.push({ name: 'Hedef', value: `<@${data.targetId}> (\`${data.targetId}\`)`, inline: true });
    if (data.roleId) metaFields.push({ name: 'Rol', value: `<@&${data.roleId}> (\`${data.roleId}\`)`, inline: true });
    if (data.channelId) metaFields.push({ name: 'Konum', value: `<#${data.channelId}>`, inline: true });

    if (metaFields.length) embed.addFields(metaFields);
    if (data.fields?.length) embed.addFields(data.fields);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[Logger] Log gonderilemedi (${tier}):`, err.message);
  }
}

module.exports = { log, LogTier };

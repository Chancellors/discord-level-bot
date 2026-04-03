const config = require('../config');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { log, LogTier } = require('../utils/logger');
const notifications = require('../utils/notifications');

/**
 * XP Engine - Progresif zorluk formuluyle seviye hesaplama
 * Formula: 5 * (L^2) + 50 * L + 100
 */

/**
 * Belirli bir seviye icin gereken toplam XP
 */
function xpForLevel(level) {
  return config.xpFormula(level);
}

/**
 * Yazi XP kazanimi islemi
 */
async function grantTextXP(message, client) {
  const { author, guild, channel } = message;
  if (author.bot || !guild) return;

  // Bakim modu kontrolu
  if (client.maintenanceMode) return;

  // Kara liste kontrolu
  const guildData = await Guild.findOne({ guildId: guild.id });
  if (guildData?.blacklistedChannels?.includes(channel.id)) return;

  // Cooldown kontrolu
  const cooldownKey = `text_${author.id}_${guild.id}`;
  const now = Date.now();
  const lastXp = client.cooldowns.get(cooldownKey);
  if (lastXp && now - lastXp < config.xp.textCooldown) return;

  // Anti-spam kontrolu
  if (guildData?.antiSpam?.enabled) {
    const spamKey = `spam_${author.id}_${guild.id}`;
    const spamData = client.cooldowns.get(spamKey) || { count: 0, resetAt: now + 60_000 };
    if (now > spamData.resetAt) {
      spamData.count = 0;
      spamData.resetAt = now + 60_000;
    }
    spamData.count++;
    client.cooldowns.set(spamKey, spamData);

    if (spamData.count > (guildData.antiSpam.maxMessagesPerMinute || 15)) {
      await log(client, guild.id, LogTier.SECURITY, {
        title: 'Anti-Spam Tetiklendi',
        description: `${author.tag} yazi spam limiti asti.`,
        operatorId: 'SYSTEM',
        targetId: author.id,
        channelId: channel.id,
      });
      return;
    }
  }

  client.cooldowns.set(cooldownKey, now);

  // XP miktari hesapla (carpanli)
  const multiplier = guildData?.xpMultiplier || 1.0;
  const baseXp = Math.floor(Math.random() * (config.xp.textMax - config.xp.textMin + 1)) + config.xp.textMin;
  const xpGain = Math.floor(baseXp * multiplier);

  // Kullanici verisini guncelle
  let userData = await User.findOneAndUpdate(
    { userId: author.id, guildId: guild.id },
    {
      $inc: { xpText: xpGain, totalMessagesText: 1 },
      $setOnInsert: { userId: author.id, guildId: guild.id },
    },
    { upsert: true, new: true }
  );

  // Dondurulmus mu? (Sureli dondurma kontrolu)
  if (userData.frozen) {
    if (userData.frozenUntil && new Date() > userData.frozenUntil) {
      // Sure dolmus, otomatik coz
      await User.updateOne(
        { userId: author.id, guildId: guild.id },
        { $set: { frozen: false, frozenBy: null, frozenAt: null, frozenUntil: null } }
      );
    } else {
      return;
    }
  }

  // Seviye kontrolu
  await checkLevelUp(client, userData, 'text', guild, author);
}

/**
 * Ses XP kazanimi islemi (voiceStateUpdate ile tetiklenir)
 */
async function grantVoiceXP(member, client, minutesInVoice) {
  if (member.user.bot) return;
  if (client.maintenanceMode) return;

  const guildData = await Guild.findOne({ guildId: member.guild.id });

  const multiplier = guildData?.xpMultiplier || 1.0;
  const xpGain = Math.floor(config.xp.voicePerMinute * minutesInVoice * multiplier);

  let userData = await User.findOneAndUpdate(
    { userId: member.id, guildId: member.guild.id },
    {
      $inc: { xpVoice: xpGain, totalMinutesVoice: minutesInVoice },
      $setOnInsert: { userId: member.id, guildId: member.guild.id },
    },
    { upsert: true, new: true }
  );

  if (userData.frozen) {
    if (userData.frozenUntil && new Date() > userData.frozenUntil) {
      await User.updateOne(
        { userId: member.id, guildId: member.guild.id },
        { $set: { frozen: false, frozenBy: null, frozenAt: null, frozenUntil: null } }
      );
    } else {
      return;
    }
  }

  await checkLevelUp(client, userData, 'voice', member.guild, member.user);
}

/**
 * Vergi (penalti) uygulama - AFK/mute/deafen
 */
async function applyTax(client, member, reason, amount) {
  const userData = await User.findOneAndUpdate(
    { userId: member.id, guildId: member.guild.id },
    {
      $inc: { xpVoice: -amount },
      $push: { taxHistory: { amount, reason } },
    },
    { new: true }
  );

  if (userData && userData.xpVoice < 0) {
    await User.updateOne(
      { userId: member.id, guildId: member.guild.id },
      { $set: { xpVoice: 0 } }
    );
  }

  await log(client, member.guild.id, LogTier.PERSONNEL, {
    title: 'Vergi Kesintisi',
    description: `**${member.user.tag}** vergilendirildi.`,
    targetId: member.id,
    fields: [
      { name: 'Miktar', value: `-${amount} XP`, inline: true },
      { name: 'Sebep', value: reason, inline: true },
    ],
  });
}

/**
 * Seviye atlama kontrolu ve rol guncelleme
 */
async function checkLevelUp(client, userData, type, guild, user) {
  const xpField = type === 'text' ? 'xpText' : 'xpVoice';
  const levelField = type === 'text' ? 'levelText' : 'levelVoice';
  const currentXp = userData[xpField];
  const currentLevel = userData[levelField];
  const requiredXp = xpForLevel(currentLevel);

  if (currentXp < requiredXp) return;

  // Seviye atla
  const newLevel = currentLevel + 1;
  const remainingXp = currentXp - requiredXp;

  await User.updateOne(
    { userId: user.id, guildId: guild.id },
    { $set: { [levelField]: newLevel, [xpField]: remainingXp } }
  );

  // Rol guncelleme
  const guildData = await Guild.findOne({ guildId: guild.id });
  const roleList = type === 'text' ? guildData?.levelRolesText : guildData?.levelRolesVoice;

  if (roleList?.length) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    // Eski seviye rolunu bul ve sil
    const oldRoleEntry = roleList.find(r => r.level === currentLevel);
    const newRoleEntry = roleList.find(r => r.level === newLevel);

    let oldRoleName = 'Yok';
    let newRoleName = 'Yok';

    if (oldRoleEntry) {
      await member.roles.remove(oldRoleEntry.roleId).catch(() => null);
      const oldRole = guild.roles.cache.get(oldRoleEntry.roleId);
      oldRoleName = oldRole?.name || oldRoleEntry.name || oldRoleEntry.roleId;
    }

    if (newRoleEntry) {
      await member.roles.add(newRoleEntry.roleId).catch(() => null);
      const newRole = guild.roles.cache.get(newRoleEntry.roleId);
      newRoleName = newRole?.name || newRoleEntry.name || newRoleEntry.roleId;
    }

    // Rol yedegini guncelle
    const freshMember = await guild.members.fetch(user.id).catch(() => null);
    if (freshMember) {
      await User.updateOne(
        { userId: user.id, guildId: guild.id },
        { $set: { roles: freshMember.roles.cache.map(r => r.id) } }
      );
    }

    // Prestij gecmisine ekle
    await User.updateOne(
      { userId: user.id, guildId: guild.id },
      {
        $push: {
          prestigeHistory: {
            type,
            oldLevel: currentLevel,
            newLevel,
            oldRole: oldRoleName,
            newRole: newRoleName,
          },
        },
      }
    );

    // Log
    await log(client, guild.id, LogTier.PERSONNEL, {
      title: `Seviye Atlama (${type === 'text' ? 'Yazı' : 'Ses'} Hattı)`,
      description: `**${user.tag}** seviye atladi!`,
      targetId: user.id,
      fields: [
        { name: 'Eski Seviye', value: `${currentLevel}`, inline: true },
        { name: 'Yeni Seviye', value: `${newLevel}`, inline: true },
        { name: 'Eski Rol', value: oldRoleName, inline: true },
        { name: 'Yeni Rol', value: newRoleName, inline: true },
      ],
    });

    // Bildirim gonder
    await notifications.sendLevelUp(client, guild.id, user, type, currentLevel, newLevel, oldRoleName, newRoleName);
  }

  // Tekrar kontrol (birden fazla seviye atlama)
  const updatedUser = await User.findOne({ userId: user.id, guildId: guild.id });
  await checkLevelUp(client, updatedUser, type, guild, user);
}

module.exports = { grantTextXP, grantVoiceXP, applyTax, xpForLevel, checkLevelUp };

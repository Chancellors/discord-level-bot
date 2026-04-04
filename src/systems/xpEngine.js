const config = require('../config');
const cache = require('../cache/manager');
const { log, LogTier } = require('../utils/logger');
const notifications = require('../utils/notifications');
const antiSpam = require('./antiSpam');
const db = require('../database/queries');

// ─── Seviye Hesaplama ─────────────────────────────────────────────────────────

function xpForLevel(level) { return level * config.xp.perLevel; }
function levelForXP(xp) { return Math.floor(xp / config.xp.perLevel); }

// ─── Carpan Zinciri ───────────────────────────────────────────────────────────

function calculateMultipliers(guildData, voiceState) {
  const breakdown = { night: 1, event: 1, stream: 1, passive: 1 };
  let isPassive = false;

  // Pasiflik kontrolu (AFK / sagir)
  if (voiceState) {
    const inAfk = voiceState.channel?.id === voiceState.guild?.afkChannelId;
    if (voiceState.deaf || voiceState.selfDeaf || inAfk) {
      breakdown.passive = config.passiveMultiplier;
      isPassive = true;
    }
  }

  // Gece carpani (pasif olanlara uygulanmaz)
  if (config.isNightTime() && !isPassive) {
    breakdown.night = config.nightMultiplier;
  }

  // Etkinlik carpani
  if (guildData && guildData.etkinlik_carpani > 1) {
    if (!guildData.etkinlik_bitisi || new Date(guildData.etkinlik_bitisi) > new Date()) {
      breakdown.event = guildData.etkinlik_carpani;
    } else {
      // Etkinlik suresi dolmus, sifirla
      cache.updateGuildField(guildData.guild_id, 'etkinlik_carpani', 1.0);
      cache.updateGuildField(guildData.guild_id, 'etkinlik_bitisi', null);
    }
  }

  // Yayin/kamera carpani (pasif olanlara uygulanmaz)
  if (voiceState && !isPassive) {
    if (voiceState.streaming || voiceState.selfVideo) {
      breakdown.stream = config.streamMultiplier;
    }
  }

  const total = breakdown.night * breakdown.event * breakdown.stream * breakdown.passive;
  return { total, breakdown };
}

// ─── Yazi XP ──────────────────────────────────────────────────────────────────

async function grantTextXP(message, client) {
  const { author, guild, channel } = message;
  if (author.bot || !guild || client.maintenanceMode) return;

  const guildData = await cache.getGuild(guild.id);
  if (!guildData) return;

  // Kara liste kanal kontrolu
  const blChannels = await db.getBlacklistedChannels(guild.id);
  if (blChannels.some(c => c.channel_id === channel.id)) return;

  // Kara liste rol kontrolu
  const blRoles = await db.getBlacklistedRoles(guild.id);
  if (blRoles.length > 0) {
    const memberRoles = message.member?.roles?.cache?.map(r => r.id) || [];
    if (blRoles.some(r => memberRoles.includes(r.role_id))) return;
  }

  // Kullanici verisi
  const userData = await cache.getUser(author.id, guild.id);
  if (!userData) return;

  // Askiya alinmis mi?
  if (userData.askida) {
    if (userData.askiya_bitis && new Date() > new Date(userData.askiya_bitis)) {
      userData.askida = false;
      userData.askiya_alan = null;
      userData.askiya_tarihi = null;
      userData.askiya_bitis = null;
      cache.setUser(author.id, guild.id, userData);
    } else {
      return;
    }
  }

  // Anti-spam
  const spamCheck = antiSpam.checkTextSpam(author.id, guild.id, message.content, guildData);
  if (!spamCheck.allowed || spamCheck.validWords === 0) return;

  // XP hesapla
  const baseXP = spamCheck.validWords * config.xp.textPerWord;
  const { total } = calculateMultipliers(guildData, null);
  const finalXP = Math.floor(baseXP * total);

  const oldLevel = userData.level_yazi;
  userData.total_words_text = (userData.total_words_text || 0) + spamCheck.validWords;
  cache.setUser(author.id, guild.id, userData);
  cache.addUserXP(author.id, guild.id, 'xp_yazi', finalXP);

  const newLevel = levelForXP((userData.xp_yazi || 0));
  if (newLevel > oldLevel) {
    await handleLevelUp(client, author.id, guild.id, 'yazi', oldLevel, newLevel);
  }
}

// ─── Ses XP ───────────────────────────────────────────────────────────────────

async function grantVoiceXP(member, client, minutes, voiceState) {
  if (member.user.bot || client.maintenanceMode) return;

  const guildData = await cache.getGuild(member.guild.id);
  if (!guildData) return;

  // Kara liste rol kontrolu
  const blRoles = await db.getBlacklistedRoles(member.guild.id);
  if (blRoles.length > 0) {
    const memberRoles = member.roles.cache.map(r => r.id);
    if (blRoles.some(r => memberRoles.includes(r.role_id))) return;
  }

  const userData = await cache.getUser(member.id, member.guild.id);
  if (!userData) return;

  if (userData.askida) {
    if (userData.askiya_bitis && new Date() > new Date(userData.askiya_bitis)) {
      userData.askida = false;
      userData.askiya_alan = null;
      userData.askiya_tarihi = null;
      userData.askiya_bitis = null;
      cache.setUser(member.id, member.guild.id, userData);
    } else {
      return;
    }
  }

  const baseXP = minutes * config.xp.voicePerMinute;
  const { total } = calculateMultipliers(guildData, voiceState);
  const finalXP = Math.floor(baseXP * total);

  const oldLevel = userData.level_ses;
  userData.total_minutes_voice = (userData.total_minutes_voice || 0) + minutes;
  cache.setUser(member.id, member.guild.id, userData);
  cache.addUserXP(member.id, member.guild.id, 'xp_ses', finalXP);

  const newLevel = levelForXP((userData.xp_ses || 0));
  if (newLevel > oldLevel) {
    await handleLevelUp(client, member.id, member.guild.id, 'ses', oldLevel, newLevel);
  }
}

// ─── Seviye Atlama ────────────────────────────────────────────────────────────

async function handleLevelUp(client, userId, guildId, hat, oldLevel, newLevel) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const userData = await cache.getUser(userId, guildId);
  if (!userData) return;

  const levelRoles = await db.getLevelRoles(guildId);
  if (!levelRoles.length) return;

  // Kullanicinin hak ettigi en yuksek rolu bul
  let qualifiedRole = null;
  let oldRoleName = 'Yok';
  let newRoleName = 'Yok';

  const { markLegitimate } = require('./roleGuard');

  for (const role of levelRoles) {
    let qualifies = false;

    if (role.mod === 'birlesik') {
      const combinedXP = (userData.xp_ses || 0) + (userData.xp_yazi || 0);
      const combinedLevel = levelForXP(combinedXP);
      const requiredLevel = Math.max(role.ses_level || 0, role.yazi_level || 0);
      qualifies = combinedLevel >= requiredLevel;
    } else {
      // ayri mod
      if (hat === 'ses' && role.ses_level !== null) {
        qualifies = (userData.level_ses || 0) >= role.ses_level;
      } else if (hat === 'yazi' && role.yazi_level !== null) {
        qualifies = (userData.level_yazi || 0) >= role.yazi_level;
      }
    }

    if (qualifies) qualifiedRole = role;
  }

  if (!qualifiedRole) return;

  // Eski seviye rollerini kaldir, yenisini ver
  for (const role of levelRoles) {
    if (role.role_id !== qualifiedRole.role_id && member.roles.cache.has(role.role_id)) {
      const oldRole = guild.roles.cache.get(role.role_id);
      if (oldRole) oldRoleName = oldRole.name;
      markLegitimate(guildId, userId);
      await member.roles.remove(role.role_id).catch(() => null);
    }
  }

  if (!member.roles.cache.has(qualifiedRole.role_id)) {
    markLegitimate(guildId, userId);
    await member.roles.add(qualifiedRole.role_id).catch(() => null);
    const newRole = guild.roles.cache.get(qualifiedRole.role_id);
    if (newRole) newRoleName = newRole.name;
  } else {
    return; // Zaten dogru rol var
  }

  // Rol yedeklerini guncelle
  const freshMember = await guild.members.fetch(userId).catch(() => null);
  if (freshMember) {
    userData.roles = JSON.stringify(freshMember.roles.cache.map(r => r.id));
    cache.setUser(userId, guildId, userData);
    await cache.flushCritical(userId, guildId);
  }

  // Kariyer sicili
  await db.addKariyerSicili(userId, guildId, {
    eski_rol: oldRoleName,
    yeni_rol: newRoleName,
    eski_level: oldLevel,
    yeni_level: newLevel,
    hat,
    gecen_sure_gun: null,
    toplam_aktif_dakika: userData.total_minutes_voice || 0,
  });

  // Log
  await log(client, guildId, LogTier.PERSONNEL, {
    title: `Seviye Atlama (${hat === 'ses' ? 'Ses' : hat === 'yazi' ? 'Yazı' : 'Birleşik'} Hattı)`,
    description: `**${member.user.tag}** seviye atladı!`,
    targetId: userId,
    fields: [
      { name: 'Eski Seviye', value: `${oldLevel}`, inline: true },
      { name: 'Yeni Seviye', value: `${newLevel}`, inline: true },
      { name: 'Yeni Rol', value: newRoleName, inline: true },
    ],
  });

  // Bildirim
  await notifications.sendLevelUp(client, guildId, member.user, hat, oldLevel, newLevel, oldRoleName, newRoleName);
}

module.exports = {
  calculateMultipliers,
  grantTextXP,
  grantVoiceXP,
  handleLevelUp,
  xpForLevel,
  levelForXP,
};

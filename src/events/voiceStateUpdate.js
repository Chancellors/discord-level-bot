const { grantVoiceXP, applyTax } = require('../systems/xpEngine');
const { log, LogTier } = require('../utils/logger');
const Guild = require('../models/Guild');
const User = require('../models/User');
const config = require('../config');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = (newState.guild || oldState.guild).id;
    const sessionKey = `voice_${member.id}_${guildId}`;

    // --- Kanaldan ayrilma veya kanal degistirme ---
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const session = client.voiceSessions.get(sessionKey);
      if (session) {
        const elapsed = Date.now() - session.joinedAt;
        const minutes = Math.floor(elapsed / 60_000);

        if (minutes > 0 && !session.afk) {
          // Seviye bazli ses kosullari kontrolu
          const guildData = await Guild.findOne({ guildId });
          const userData = await User.findOne({ userId: member.id, guildId });
          const voiceLevel = userData?.levelVoice || 0;
          const vc = guildData?.voiceConditions || {};

          let effectiveMinutes = minutes;
          let blocked = false;

          // Deafen kontrolu - seviye bazli
          if (session.deafened) {
            if (voiceLevel < (vc.deafenAllowedLevel || 0)) {
              effectiveMinutes = 0;
              blocked = true;
            } else {
              effectiveMinutes = Math.floor(minutes * config.tax.deafPenaltyMultiplier);
            }
          }
          // Mute kontrolu - seviye bazli
          else if (session.muted) {
            if (voiceLevel < (vc.muteAllowedLevel || 0)) {
              effectiveMinutes = 0;
              blocked = true;
            } else {
              effectiveMinutes = Math.floor(minutes * config.tax.mutePenaltyMultiplier);
            }
          }

          // Solo kontrolu - odada tek kisi
          if (session.soloTime > 0 && voiceLevel < (vc.soloXpLevel || 0)) {
            effectiveMinutes = Math.max(0, effectiveMinutes - session.soloTime);
          }

          if (effectiveMinutes > 0 && !blocked) {
            await grantVoiceXP(member, client, effectiveMinutes);
          }

          // Vergi uygula (AFK suresi varsa)
          if (session.afkMinutes > 0) {
            const taxAmount = session.afkMinutes * config.tax.afkPenaltyPerMinute;
            await applyTax(client, member, 'AFK süresi vergilendirmesi', taxAmount);
          }
        }

        client.voiceSessions.delete(sessionKey);
      }
    }

    // --- Kanala katilma ---
    if (newState.channelId && oldState.channelId !== newState.channelId) {
      const guild = newState.guild;
      const isAfk = guild.afkChannelId && newState.channelId === guild.afkChannelId;

      if (isAfk) {
        await log(client, guildId, LogTier.PERSONNEL, {
          title: 'XP Kazanım Durduruldu',
          description: `**${member.user.tag}** AFK odasına girdi. XP kazanımı durduruldu.`,
          targetId: member.id,
          channelId: newState.channelId,
        });
      }

      // Anti-spam: Voice hop kontrolu
      const guildData = await Guild.findOne({ guildId });
      if (guildData?.antiSpam?.enabled) {
        const hopKey = `vhop_${member.id}_${guildId}`;
        const hopData = client.cooldowns.get(hopKey) || { count: 0, resetAt: Date.now() + (guildData.antiSpam.voiceHopWindow || 60_000) };
        if (Date.now() > hopData.resetAt) {
          hopData.count = 0;
          hopData.resetAt = Date.now() + (guildData.antiSpam.voiceHopWindow || 60_000);
        }
        hopData.count++;
        client.cooldowns.set(hopKey, hopData);

        if (hopData.count > (guildData.antiSpam.voiceHopLimit || 5)) {
          await log(client, guildId, LogTier.SECURITY, {
            title: 'Anti-Spam: Ses Odası Manipülasyonu',
            description: `**${member.user.tag}** hızlı kanal değiştirme limiti aştı.`,
            targetId: member.id,
            channelId: newState.channelId,
          });
        }
      }

      // Odadaki kisi sayisini kontrol et
      const channelMembers = newState.channel?.members.filter(m => !m.user.bot).size || 0;

      client.voiceSessions.set(sessionKey, {
        joinedAt: Date.now(),
        channelId: newState.channelId,
        muted: newState.selfMute || newState.serverMute,
        deafened: newState.selfDeaf || newState.serverDeaf,
        afk: isAfk,
        afkMinutes: 0,
        soloTime: 0, // Tek basina gecirilen dakika
      });
    }

    // --- Mute/Deafen durum degisimi ---
    if (newState.channelId && oldState.channelId === newState.channelId) {
      const session = client.voiceSessions.get(sessionKey);
      if (session) {
        const wasMuted = session.muted;
        const wasDeafened = session.deafened;
        session.muted = newState.selfMute || newState.serverMute;
        session.deafened = newState.selfDeaf || newState.serverDeaf;

        // Mikrofon kapattiysa logla
        if (!wasMuted && session.muted) {
          await log(client, guildId, LogTier.PERSONNEL, {
            title: 'XP Kazanım Durduruldu',
            description: `**${member.user.tag}** mikrofonunu kapattı. XP çarpanı düşürüldü.`,
            targetId: member.id,
            channelId: newState.channelId,
          });
        }

        // Kulaklik kapattiysa logla
        if (!wasDeafened && session.deafened) {
          await log(client, guildId, LogTier.PERSONNEL, {
            title: 'XP Kazanım Durduruldu',
            description: `**${member.user.tag}** kulaklığını kapattı (Deafen). XP kazanımı durduruldu.`,
            targetId: member.id,
            channelId: newState.channelId,
          });
        }

        client.voiceSessions.set(sessionKey, session);
      }
    }
  },
};

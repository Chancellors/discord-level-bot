const { grantVoiceXP } = require('../systems/xpEngine');
const antiSpam = require('../systems/antiSpam');
const cache = require('../cache/manager');

// Periyodik XP zamanlayici referansi
let voiceXpInterval = null;

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    const userId = member.id;
    const sessionKey = `${userId}_${guildId}`;

    // ─── Periyodik XP zamanlayicisini baslat (bir kez) ──────────────
    if (!voiceXpInterval) {
      voiceXpInterval = setInterval(async () => {
        await grantPeriodicVoiceXP(client);
      }, 60_000); // Her 60 saniye
      console.log('[Voice] Periyodik XP zamanlayicisi baslatildi (60sn).');
    }

    // ─── Kanala katildi ─────────────────────────────────────────────
    if (!oldState.channel && newState.channel) {
      client.voiceSessions.set(sessionKey, {
        joinedAt: Date.now(),
        channelId: newState.channel.id,
        lastXpAt: Date.now(),
      });
      return;
    }

    // ─── Kanaldan ayrildi ───────────────────────────────────────────
    if (oldState.channel && !newState.channel) {
      const session = client.voiceSessions.get(sessionKey);
      if (session) {
        const minutes = Math.floor((Date.now() - session.lastXpAt) / 60_000);
        if (minutes >= 1) {
          const guildData = await cache.getGuild(guildId);
          const minUsers = guildData?.voice_min_users || 2;
          const channelMembers = oldState.channel.members.filter(m => !m.user.bot).size;

          if (channelMembers >= minUsers || (guildData?.voice_afk_xp_allowed && oldState.channel.id === oldState.guild.afkChannelId)) {
            await grantVoiceXP(member, client, minutes, oldState);
          }
        }
        client.voiceSessions.delete(sessionKey);
      }
      return;
    }

    // ─── Kanal degistirdi (switch veya JTC bot tasiması) ────────────
    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      const session = client.voiceSessions.get(sessionKey);

      // JTC bot korumasi: 10 saniye icinde tasindiysa hop olarak sayma
      const timeSinceJoin = session ? Date.now() - session.joinedAt : Infinity;
      const isJtcMove = timeSinceJoin < 10_000; // 10 saniye icinde tasindi = JTC

      if (!isJtcMove) {
        // Voice hop kontrolu (sadece JTC degilse)
        const guildData = await cache.getGuild(guildId);
        if (guildData?.anti_spam_enabled) {
          const isHopping = antiSpam.checkVoiceHop(userId, guildId, guildData);
          if (isHopping) return;
        }

        // Eski kanaldan XP ver
        if (session) {
          const minutes = Math.floor((Date.now() - session.lastXpAt) / 60_000);
          if (minutes >= 1) {
            await grantVoiceXP(member, client, minutes, oldState);
          }
        }
      }

      // Yeni oturum baslat (kanal guncelle)
      client.voiceSessions.set(sessionKey, {
        joinedAt: isJtcMove ? (session?.joinedAt || Date.now()) : Date.now(),
        channelId: newState.channel.id,
        lastXpAt: isJtcMove ? (session?.lastXpAt || Date.now()) : Date.now(),
      });
      return;
    }
  },
};

// ─── Her dakika tum aktif ses kullanicilarini tarayip XP ver ─────────────────
async function grantPeriodicVoiceXP(client) {
  for (const [sessionKey, session] of client.voiceSessions.entries()) {
    const [userId, guildId] = sessionKey.split('_');
    const minutes = Math.floor((Date.now() - session.lastXpAt) / 60_000);
    if (minutes < 1) continue;

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member || member.user.bot) continue;

      const voiceState = member.voice;
      if (!voiceState?.channel) {
        // Artik seste degil, oturumu temizle
        client.voiceSessions.delete(sessionKey);
        continue;
      }

      const guildData = await cache.getGuild(guildId);
      const minUsers = guildData?.voice_min_users || 2;
      const channelMembers = voiceState.channel.members.filter(m => !m.user.bot).size;

      if (channelMembers >= minUsers || (guildData?.voice_afk_xp_allowed && voiceState.channel.id === guild.afkChannelId)) {
        await grantVoiceXP(member, client, minutes, voiceState);
        session.lastXpAt = Date.now();
      }
    } catch (err) {
      console.error(`[Voice] Periyodik XP hatasi (${sessionKey}):`, err.message);
    }
  }
}

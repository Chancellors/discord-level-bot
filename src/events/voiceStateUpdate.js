const { grantVoiceXP } = require('../systems/xpEngine');
const antiSpam = require('../systems/antiSpam');
const cache = require('../cache/manager');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    const userId = member.id;
    const sessionKey = `${userId}_${guildId}`;

    // Kanala katildi
    if (!oldState.channel && newState.channel) {
      client.voiceSessions.set(sessionKey, {
        joinedAt: Date.now(),
        channelId: newState.channel.id,
        lastXpAt: Date.now(),
      });
      return;
    }

    // Kanaldan ayrildi
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

    // Kanal degistirdi
    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      // Voice hop kontrolu
      const guildData = await cache.getGuild(guildId);
      if (guildData?.anti_spam_enabled) {
        const isHopping = antiSpam.checkVoiceHop(userId, guildId, guildData);
        if (isHopping) return;
      }

      // Eski kanaldan XP ver
      const session = client.voiceSessions.get(sessionKey);
      if (session) {
        const minutes = Math.floor((Date.now() - session.lastXpAt) / 60_000);
        if (minutes >= 1) {
          await grantVoiceXP(member, client, minutes, oldState);
        }
      }

      // Yeni oturum baslat
      client.voiceSessions.set(sessionKey, {
        joinedAt: Date.now(),
        channelId: newState.channel.id,
        lastXpAt: Date.now(),
      });
      return;
    }

    // Periyodik XP verme (her dakika tetiklenir)
    const session = client.voiceSessions.get(sessionKey);
    if (session && newState.channel) {
      const minutes = Math.floor((Date.now() - session.lastXpAt) / 60_000);
      if (minutes >= 1) {
        const guildData = await cache.getGuild(guildId);
        const minUsers = guildData?.voice_min_users || 2;
        const channelMembers = newState.channel.members.filter(m => !m.user.bot).size;

        if (channelMembers >= minUsers) {
          await grantVoiceXP(member, client, minutes, newState);
          session.lastXpAt = Date.now();
        }
      }
    }
  },
};

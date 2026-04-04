const cache = require('../cache/manager');
const db = require('../database/queries');
const { log, LogTier } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const guildId = member.guild.id;
      const currentRoles = member.roles.cache.filter(r => r.id !== guildId).map(r => r.id);

      // Ayrilma sebebi
      let leaveReason = 'leave';
      try {
        const kickLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 });
        const kickEntry = kickLogs.entries.first();
        if (kickEntry && kickEntry.target.id === member.id && Date.now() - kickEntry.createdTimestamp < 5000) {
          leaveReason = 'kick';
        }
        if (leaveReason === 'leave') {
          const banLogs = await member.guild.fetchAuditLogs({ type: 22, limit: 1 });
          const banEntry = banLogs.entries.first();
          if (banEntry && banEntry.target.id === member.id && Date.now() - banEntry.createdTimestamp < 5000) {
            leaveReason = 'ban';
          }
        }
      } catch { /* */ }

      // Kullanici verisini koru
      const userData = await cache.getUser(member.id, guildId);
      if (userData) {
        userData.left_at = new Date().toISOString();
        userData.last_known_roles = JSON.stringify(currentRoles);
        userData.last_leave_reason = leaveReason;
        userData.leave_count = (userData.leave_count || 0) + 1;
        cache.setUser(member.id, guildId, userData);
        await cache.flushCritical(member.id, guildId);
      }

      const reasonText = { leave: 'Ayrıldı', kick: 'Atıldı', ban: 'Banlandı' };
      await db.addRecord(member.id, guildId, reasonText[leaveReason], `Sunucudan ${reasonText[leaveReason].toLowerCase()}.`, 'SYSTEM');

      await log(client, guildId, leaveReason === 'ban' ? LogTier.SECURITY : LogTier.PERSONNEL, {
        title: 'Personel Ayrıldı — Veri Korunuyor',
        description: `**${member.user.tag}** sunucudan ayrıldı.`,
        targetId: member.id,
        fields: [
          { name: 'Sebep', value: reasonText[leaveReason], inline: true },
          { name: 'Seviyeler', value: userData ? `Ses: Lv.${userData.level_ses} | Yazı: Lv.${userData.level_yazi}` : 'Yok', inline: true },
        ],
      });

      // Ayrilma mesaji
      const guildData = await cache.getGuild(guildId);
      if (guildData?.leave_enabled && guildData.leave_channel && guildData.leave_message) {
        const msg = guildData.leave_message
          .replace(/\[user\]/g, `<@${member.id}>`)
          .replace(/\[userName\]/g, member.user.username)
          .replace(/\[memberCount\]/g, `${member.guild.memberCount}`)
          .replace(/\[server\]/g, member.guild.name);
        const ch = member.guild.channels.cache.get(guildData.leave_channel);
        if (ch) await ch.send(msg).catch(() => null);
      }
    } catch (err) {
      console.error('[guildMemberRemove] Hata:', err.message);
    }
  },
};

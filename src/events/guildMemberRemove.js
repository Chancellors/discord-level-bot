const User = require('../models/User');
const Guild = require('../models/Guild');
const { log, LogTier } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const guildId = member.guild.id;

      // Mevcut rolleri kaydet (ayrilma anindaki son durum)
      const currentRoles = member.roles.cache
        .filter(r => r.id !== guildId) // @everyone haric
        .map(r => r.id);

      // Ayrilma sebebini audit logdan tespit et
      let leaveReason = 'leave';
      try {
        // Kick kontrolu
        const kickLogs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 }); // MEMBER_KICK
        const kickEntry = kickLogs.entries.first();
        if (kickEntry && kickEntry.target.id === member.id && Date.now() - kickEntry.createdTimestamp < 5000) {
          leaveReason = 'kick';
        }

        // Ban kontrolu
        if (leaveReason === 'leave') {
          const banLogs = await member.guild.fetchAuditLogs({ type: 22, limit: 1 }); // MEMBER_BAN_ADD
          const banEntry = banLogs.entries.first();
          if (banEntry && banEntry.target.id === member.id && Date.now() - banEntry.createdTimestamp < 5000) {
            leaveReason = 'ban';
          }
        }
      } catch {
        // Audit log izni yoksa 'leave' olarak birak
      }

      // Kullanici verisini guncelle - VERİYİ SİLME, koru
      const userData = await User.findOneAndUpdate(
        { userId: member.id, guildId },
        {
          $set: {
            leftAt: new Date(),
            lastKnownRoles: currentRoles,
            lastLeaveReason: leaveReason,
          },
          $inc: { leaveCount: 1 },
          $setOnInsert: { userId: member.id, guildId },
        },
        { upsert: true, new: true }
      );

      // Sicil kaydina ekle
      await User.updateOne(
        { userId: member.id, guildId },
        {
          $push: {
            records: {
              action: leaveReason === 'ban' ? 'Ban' : leaveReason === 'kick' ? 'Atılma' : 'Ayrılma',
              reason: leaveReason === 'ban' ? 'Sunucudan banlandı' : leaveReason === 'kick' ? 'Sunucudan atıldı' : 'Sunucudan ayrıldı',
              operatorId: 'SYSTEM',
            },
          },
        }
      );

      // Ayrilma sebebine gore log tipi
      const logTier = leaveReason === 'ban' ? LogTier.SECURITY : LogTier.PERSONNEL;

      const reasonText = {
        leave: '🚪 Kendi isteğiyle ayrıldı',
        kick: '👢 Sunucudan atıldı',
        ban: '🔨 Sunucudan banlandı',
      };

      const fields = [
        { name: 'Sebep', value: reasonText[leaveReason], inline: true },
        { name: 'Ayrılma Sayısı', value: `${userData.leaveCount}`, inline: true },
      ];

      // Seviye bilgisi varsa ekle
      if (userData.levelText > 0 || userData.levelVoice > 0) {
        fields.push({
          name: 'Korunan Veriler',
          value: [
            `📝 Yazı: Lv.${userData.levelText} (${userData.xpText} XP)`,
            `🎙️ Ses: Lv.${userData.levelVoice} (${userData.xpVoice} XP)`,
            `💬 Mesaj: ${userData.totalMessagesText}`,
            `⏱️ Ses: ${userData.totalMinutesVoice} dk`,
          ].join('\n'),
          inline: false,
        });
      }

      if (currentRoles.length > 0) {
        fields.push({
          name: `Yedeklenen Roller (${currentRoles.length})`,
          value: currentRoles.map(r => `<@&${r}>`).join(', ').substring(0, 1024),
          inline: false,
        });
      }

      await log(client, guildId, logTier, {
        title: 'Personel Ayrıldı — Veri Korunuyor',
        description: `**${member.user.tag}** sunucudan ayrıldı. Tüm seviye verileri ve roller yedeklendi.`,
        targetId: member.id,
        fields,
      });

      // --- AYRILMA MESAJI ---
      const guildData = await Guild.findOne({ guildId });
      if (guildData?.leaveEnabled && guildData.leaveChannel && guildData.leaveMessage) {
        const leaveMsg = guildData.leaveMessage
          .replace(/\[user\]/g, `<@${member.id}>`)
          .replace(/\[userName\]/g, member.user.username)
          .replace(/\[memberCount\]/g, `${member.guild.memberCount}`)
          .replace(/\[server\]/g, member.guild.name);

        const channel = member.guild.channels.cache.get(guildData.leaveChannel);
        if (channel) {
          await channel.send(leaveMsg).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[guildMemberRemove] Hata:', err.message);
    }
  },
};

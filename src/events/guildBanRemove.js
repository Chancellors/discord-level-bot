const User = require('../models/User');
const { log, LogTier } = require('../utils/logger');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban, client) {
    if (ban.user.bot) return;

    try {
      const guildId = ban.guild.id;
      const userData = await User.findOne({ userId: ban.user.id, guildId });

      if (!userData) return;

      // Sicil kaydina ekle
      await User.updateOne(
        { userId: ban.user.id, guildId },
        {
          $push: {
            records: {
              action: 'Ban Kaldırma',
              reason: 'Sunucu banı kaldırıldı. Geri dönüşte veriler geri yüklenecek.',
              operatorId: 'SYSTEM',
            },
          },
        }
      );

      await log(client, guildId, LogTier.PERSONNEL, {
        title: 'Ban Kaldırıldı — Veriler Hazır',
        description: `**${ban.user.tag}** banı kaldırıldı. Sunucuya geri dönerse tüm verileri otomatik geri yüklenecek.`,
        targetId: ban.user.id,
        fields: [
          {
            name: '📊 Korunan Veriler',
            value: [
              `📝 Yazı: Lv.${userData.levelText} (${userData.xpText} XP)`,
              `🎙️ Ses: Lv.${userData.levelVoice} (${userData.xpVoice} XP)`,
            ].join('\n'),
            inline: true,
          },
        ],
      });
    } catch (err) {
      console.error('[guildBanRemove] Hata:', err.message);
    }
  },
};

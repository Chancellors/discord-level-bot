const cache = require('../cache/manager');
const db = require('../database/queries');
const { log, LogTier } = require('../utils/logger');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban, client) {
    if (ban.user.bot) return;
    try {
      const userData = await cache.getUser(ban.user.id, ban.guild.id);
      if (!userData) return;

      await db.addRecord(ban.user.id, ban.guild.id, 'Ban Kaldırma', 'Sunucu banı kaldırıldı.', 'SYSTEM');

      await log(client, ban.guild.id, LogTier.PERSONNEL, {
        title: 'Ban Kaldırıldı — Veriler Hazır',
        description: `**${ban.user.tag}** banı kaldırıldı. Geri dönerse verileri geri yüklenecek.`,
        targetId: ban.user.id,
      });
    } catch (err) {
      console.error('[guildBanRemove] Hata:', err.message);
    }
  },
};

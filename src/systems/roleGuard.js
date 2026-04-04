const cache = require('../cache/manager');
const db = require('../database/queries');
const { log, LogTier } = require('../utils/logger');

const legitimateOperations = new Set();

function markLegitimate(guildId, userId) {
  const key = `${guildId}_${userId}`;
  legitimateOperations.add(key);
  setTimeout(() => legitimateOperations.delete(key), 10_000);
}

function init(client) {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      if (newMember.user.bot) return;

      const key = `${newMember.guild.id}_${newMember.id}`;

      if (legitimateOperations.has(key)) {
        legitimateOperations.delete(key);
        const userData = await cache.getUser(newMember.id, newMember.guild.id);
        if (userData) {
          userData.roles = JSON.stringify(newMember.roles.cache.map(r => r.id));
          cache.setUser(newMember.id, newMember.guild.id, userData);
        }
        return;
      }

      const oldRoles = oldMember.roles.cache.map(r => r.id);
      const newRoles = newMember.roles.cache.map(r => r.id);

      if (oldRoles.length === newRoles.length && oldRoles.every(r => newRoles.includes(r))) return;

      const userData = await cache.getUser(newMember.id, newMember.guild.id);
      if (!userData) return;

      // Seviye rollerini bul
      const levelRoles = await db.getLevelRoles(newMember.guild.id);
      const levelRoleIds = new Set(levelRoles.map(r => r.role_id));

      const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
      const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

      const illegalAdds = addedRoles.filter(r => levelRoleIds.has(r));
      const illegalRemoves = removedRoles.filter(r => levelRoleIds.has(r));

      if (illegalAdds.length === 0 && illegalRemoves.length === 0) {
        userData.roles = JSON.stringify(newRoles);
        cache.setUser(newMember.id, newMember.guild.id, userData);
        return;
      }

      // IHLAL! Geri al
      let executorId = 'BILINMIYOR';
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({ type: 25, limit: 1 });
        const entry = auditLogs.entries.first();
        if (entry && entry.target.id === newMember.id && Date.now() - entry.createdTimestamp < 5000) {
          executorId = entry.executor.id;
        }
      } catch { /* */ }

      const backupRoles = JSON.parse(userData.roles || '[]').filter(r => r !== newMember.guild.id);
      try {
        await newMember.roles.set(backupRoles);
      } catch (err) {
        console.error('[RoleGuard] Rol geri alma basarisiz:', err.message);
      }

      await log(client, newMember.guild.id, LogTier.SECURITY, {
        title: 'Manuel Rol İhlali Tespit Edildi!',
        description: `Yetkisiz rol müdahalesi geri alındı.\n**${newMember.user.tag}** üzerindeki roller onarıldı.`,
        operatorId: executorId,
        targetId: newMember.id,
        fields: [
          { name: 'Eklenen (Geri Alınan)', value: illegalAdds.map(r => `<@&${r}>`).join(', ') || 'Yok', inline: true },
          { name: 'Silinen (Geri Verilen)', value: illegalRemoves.map(r => `<@&${r}>`).join(', ') || 'Yok', inline: true },
        ],
      });
    } catch (err) {
      console.error('[RoleGuard] Hata:', err.message);
    }
  });

  console.log('[RoleGuard] Self-Healing sistemi aktif.');
}

module.exports = { init, markLegitimate };

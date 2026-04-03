const User = require('../models/User');
const Guild = require('../models/Guild');
const { log, LogTier } = require('../utils/logger');

/**
 * Role Guard (Self-Healing) Sistemi
 *
 * guildMemberUpdate olayini dinler.
 * MongoDB'deki rol yedekleriyle karsilastirir.
 * Manuel (sag tik) rol mudahalelerini "yasa disi" sayar ve geri alir.
 * Sadece /kullanici-yonet komutuyla yapilan degisimler "mesru" kabul edilir.
 */

// Mesru islemleri izlemek icin set
const legitimateOperations = new Set();

/**
 * Bir islemi mesru olarak isaretle (komut tarafindan cagirilir)
 */
function markLegitimate(guildId, userId) {
  const key = `${guildId}_${userId}`;
  legitimateOperations.add(key);
  // 10 saniye sonra temizle
  setTimeout(() => legitimateOperations.delete(key), 10_000);
}

/**
 * Sistemin baslatilmasi - event listener kaydeder
 */
function init(client) {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      // Bot kendisi ise atla
      if (newMember.user.bot) return;

      const key = `${newMember.guild.id}_${newMember.id}`;

      // Mesru islem mi?
      if (legitimateOperations.has(key)) {
        legitimateOperations.delete(key);
        // Yedegi guncelle
        await User.updateOne(
          { userId: newMember.id, guildId: newMember.guild.id },
          { $set: { roles: newMember.roles.cache.map(r => r.id) } },
          { upsert: true }
        );
        return;
      }

      const oldRoles = oldMember.roles.cache.map(r => r.id);
      const newRoles = newMember.roles.cache.map(r => r.id);

      // Rol degisimi yoksa atla
      if (oldRoles.length === newRoles.length && oldRoles.every(r => newRoles.includes(r))) return;

      // Veritabanindaki yedegi kontrol et
      const userData = await User.findOne({ userId: newMember.id, guildId: newMember.guild.id });

      // Kullanici veritabaninda yoksa (ilk kez), kaydet ve atla
      if (!userData) {
        await User.create({
          userId: newMember.id,
          guildId: newMember.guild.id,
          roles: newRoles,
        });
        return;
      }

      // Guild ayarlarini kontrol et
      const guildData = await Guild.findOne({ guildId: newMember.guild.id });

      // Seviye rollerini bul
      const levelRoleIds = new Set();
      if (guildData) {
        guildData.levelRolesText.forEach(r => levelRoleIds.add(r.roleId));
        guildData.levelRolesVoice.forEach(r => levelRoleIds.add(r.roleId));
      }

      // Eklenen ve silinen rolleri bul
      const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
      const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

      // Seviye rolu mudahalesi var mi?
      const illegalAdds = addedRoles.filter(r => levelRoleIds.has(r));
      const illegalRemoves = removedRoles.filter(r => levelRoleIds.has(r));

      if (illegalAdds.length === 0 && illegalRemoves.length === 0) {
        // Seviye rolu degilse, yedegi guncelle ve atla
        await User.updateOne(
          { userId: newMember.id, guildId: newMember.guild.id },
          { $set: { roles: newRoles } }
        );
        return;
      }

      // !!! IHLAL TESPIT EDILDI - Self-Healing baslatiliyor !!!

      // Audit logdan mudahale edeni bul
      let executorId = 'BILINMIYOR';
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: 25, // MEMBER_ROLE_UPDATE
          limit: 1,
        });
        const entry = auditLogs.entries.first();
        if (entry && entry.target.id === newMember.id && Date.now() - entry.createdTimestamp < 5000) {
          executorId = entry.executor.id;
        }
      } catch {
        // Audit log izni yoksa devam et
      }

      // Rolleri geri al (yedekteki duruma dondur)
      const backupRoles = userData.roles.filter(r => r !== newMember.guild.id); // @everyone haric
      try {
        await newMember.roles.set(backupRoles);
      } catch (err) {
        console.error('[RoleGuard] Rol geri alma basarisiz:', err.message);
      }

      // Guvenlik logu
      await log(client, newMember.guild.id, LogTier.SECURITY, {
        title: 'Manuel Rol İhlali Tespit Edildi!',
        description: `Yetkisiz rol müdahalesi geri alindi.\n**${newMember.user.tag}** uzerindeki roller onarildi.`,
        operatorId: executorId,
        targetId: newMember.id,
        fields: [
          {
            name: 'Eklenen (Geri Alinan)',
            value: illegalAdds.map(r => `<@&${r}>`).join(', ') || 'Yok',
            inline: true,
          },
          {
            name: 'Silinen (Geri Verilen)',
            value: illegalRemoves.map(r => `<@&${r}>`).join(', ') || 'Yok',
            inline: true,
          },
        ],
      });
    } catch (err) {
      console.error('[RoleGuard] Hata:', err.message);
    }
  });

  console.log('[RoleGuard] Self-Healing sistemi aktif.');
}

module.exports = { init, markLegitimate };

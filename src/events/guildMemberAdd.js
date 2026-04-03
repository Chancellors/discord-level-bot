const Guild = require('../models/Guild');
const User = require('../models/User');
const { log, LogTier } = require('../utils/logger');
const { markLegitimate } = require('../systems/roleGuard');

/**
 * Karsilayici degiskenlerini uygula
 */
function applyWelcomeVars(template, member) {
  return template
    .replace(/\[user\]/g, `<@${member.id}>`)
    .replace(/\[userName\]/g, member.user.username)
    .replace(/\[memberCount\]/g, `${member.guild.memberCount}`)
    .replace(/\[server\]/g, member.guild.name);
}

/**
 * Hosgeldin mesaji gonder
 */
async function sendWelcome(member, guildData) {
  if (!guildData?.welcomeEnabled) return;
  if (!guildData.welcomeMessage) return;

  const message = applyWelcomeVars(guildData.welcomeMessage, member);

  // DM mi kanala mi?
  if (guildData.welcomeSendDM) {
    try {
      await member.send(message);
    } catch {
      // DM kapali olabilir, kanala yaz fallback
      if (guildData.welcomeChannel) {
        const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
        if (channel) await channel.send(message).catch(() => null);
      }
    }
  } else {
    if (!guildData.welcomeChannel) return;
    const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
    if (channel) await channel.send(message).catch(() => null);
  }
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const guildId = member.guild.id;
      const guildData = await Guild.findOne({ guildId });
      const userData = await User.findOne({ userId: member.id, guildId });

      // --- GERI DONEN UYE TESPITI ---
      if (userData && userData.leftAt) {
        const restoredRoles = [];
        const failedRoles = [];

        // 1. Onceki rolleri geri ver (lastKnownRoles)
        if (userData.lastKnownRoles?.length) {
          for (const roleId of userData.lastKnownRoles) {
            const role = member.guild.roles.cache.get(roleId);
            if (role && role.id !== guildId && !role.managed) {
              try {
                markLegitimate(guildId, member.id);
                await member.roles.add(role);
                restoredRoles.push(roleId);
              } catch {
                failedRoles.push(roleId);
              }
            } else if (!role) {
              failedRoles.push(roleId);
            }
          }
        }

        // 2. Seviye rollerini kontrol et - hak ettigi en yuksek rolu ver
        if (guildData) {
          for (const type of ['text', 'voice']) {
            const field = type === 'text' ? 'levelRolesText' : 'levelRolesVoice';
            const userLevel = type === 'text' ? userData.levelText : userData.levelVoice;
            const roleList = guildData[field] || [];

            if (!roleList.length) continue;

            const qualifiedRole = roleList
              .filter(r => userLevel >= r.level)
              .sort((a, b) => b.level - a.level)[0];

            if (qualifiedRole) {
              const role = member.guild.roles.cache.get(qualifiedRole.roleId);
              if (role && !restoredRoles.includes(qualifiedRole.roleId)) {
                try {
                  markLegitimate(guildId, member.id);
                  await member.roles.add(role);
                  restoredRoles.push(qualifiedRole.roleId);
                } catch {
                  failedRoles.push(qualifiedRole.roleId);
                }
              }
            }

            // Hak etmedigi seviye rollerini cikar
            for (const r of roleList) {
              if (r.roleId !== qualifiedRole?.roleId && member.roles.cache.has(r.roleId)) {
                markLegitimate(guildId, member.id);
                await member.roles.remove(r.roleId).catch(() => null);
              }
            }
          }
        }

        // 3. Baslangic rollerini de ekle (eksikse)
        if (guildData?.startingRoles?.length) {
          for (const roleId of guildData.startingRoles) {
            if (!member.roles.cache.has(roleId) && !restoredRoles.includes(roleId)) {
              try {
                markLegitimate(guildId, member.id);
                await member.roles.add(roleId);
                restoredRoles.push(roleId);
              } catch { /* ignore */ }
            }
          }
        }

        // 4. Veritabanini guncelle
        const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
        await User.updateOne(
          { userId: member.id, guildId },
          {
            $set: {
              leftAt: null,
              lastLeaveReason: null,
              lastKnownRoles: [],
              roles: freshMember ? freshMember.roles.cache.map(r => r.id) : [],
            },
            $push: {
              records: {
                action: 'Geri Dönüş',
                reason: `Sunucuya geri döndü. ${restoredRoles.length} rol geri verildi.`,
                operatorId: 'SYSTEM',
              },
            },
          }
        );

        // 5. Ayrilma suresi hesapla
        const awayDuration = Date.now() - new Date(userData.leftAt).getTime();
        const awayDays = Math.floor(awayDuration / (1000 * 60 * 60 * 24));
        const awayHours = Math.floor((awayDuration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        const fields = [
          {
            name: '📊 Korunan Seviyeler',
            value: [
              `📝 Yazı: **Lv.${userData.levelText}** (${userData.xpText} XP)`,
              `🎙️ Ses: **Lv.${userData.levelVoice}** (${userData.xpVoice} XP)`,
              `💬 Toplam Mesaj: ${userData.totalMessagesText}`,
              `⏱️ Toplam Ses: ${userData.totalMinutesVoice} dk`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🔄 Geri Yükleme',
            value: [
              `✅ Geri Verilen: ${restoredRoles.length} rol`,
              failedRoles.length ? `⚠️ Başarısız: ${failedRoles.length} rol (silinmiş?)` : null,
              `📅 Uzak Kalma: ${awayDays > 0 ? `${awayDays} gün ` : ''}${awayHours} saat`,
              `🔢 Toplam Ayrılma: ${userData.leaveCount} kez`,
            ].filter(Boolean).join('\n'),
            inline: true,
          },
        ];

        if (userData.frozen) {
          fields.push({
            name: '❄️ Dondurma Durumu',
            value: 'Bu üye hâlâ **dondurulmuş** durumda. XP kazanamıyor.',
            inline: false,
          });
        }

        const prevReason = {
          leave: 'Kendi isteğiyle ayrılmıştı',
          kick: 'Sunucudan atılmıştı',
          ban: 'Sunucudan banlanmıştı',
        };

        if (userData.lastLeaveReason) {
          fields.push({
            name: '📋 Önceki Ayrılma',
            value: prevReason[userData.lastLeaveReason] || 'Bilinmiyor',
            inline: true,
          });
        }

        await log(client, guildId, LogTier.PERSONNEL, {
          title: '🔄 Personel Geri Döndü — Veriler Geri Yüklendi',
          description: `**${member.user.tag}** sunucuya geri döndü. Tüm seviyeleri, XP'si ve rolleri otomatik olarak geri verildi.`,
          targetId: member.id,
          fields,
        });

        // Geri donen uye icin de hosgeldin mesaji gonder
        await sendWelcome(member, guildData);
        return;
      }

      // --- YENI UYE (ilk kez katiliyor) ---

      // Baslangic rollerini ver
      const assignedRoles = [];
      if (guildData?.startingRoles?.length) {
        for (const roleId of guildData.startingRoles) {
          try {
            markLegitimate(guildId, member.id);
            await member.roles.add(roleId);
            assignedRoles.push(roleId);
          } catch { /* ignore */ }
        }
      }

      // Kullanici kaydini olustur ve rolleri yedekle
      const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
      if (freshMember) {
        await User.findOneAndUpdate(
          { userId: member.id, guildId },
          {
            $setOnInsert: { userId: member.id, guildId },
            $set: { roles: freshMember.roles.cache.map(r => r.id) },
          },
          { upsert: true }
        );
      }

      await log(client, guildId, LogTier.PERSONNEL, {
        title: 'Yeni Personel Katıldı',
        description: `**${member.user.tag}** sunucuya ilk kez katıldı.${assignedRoles.length ? ' Başlangıç rolleri atandı.' : ''}`,
        targetId: member.id,
        fields: assignedRoles.length ? [
          {
            name: 'Verilen Roller',
            value: assignedRoles.map(r => `<@&${r}>`).join(', '),
            inline: false,
          },
        ] : [],
      });

      // Hosgeldin mesaji gonder
      await sendWelcome(member, guildData);
    } catch (err) {
      console.error('[guildMemberAdd] Hata:', err.message);
    }
  },
};

const cache = require('../cache/manager');
const db = require('../database/queries');
const { log, LogTier } = require('../utils/logger');
const { markLegitimate } = require('../systems/roleGuard');

function applyVars(template, member) {
  return (template || '')
    .replace(/\[user\]/g, `<@${member.id}>`)
    .replace(/\[userName\]/g, member.user.username)
    .replace(/\[memberCount\]/g, `${member.guild.memberCount}`)
    .replace(/\[server\]/g, member.guild.name);
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const guildId = member.guild.id;
      const guildData = await cache.getGuild(guildId);
      const userData = await cache.getUser(member.id, guildId);

      // GERI DONEN UYE
      if (userData && userData.left_at) {
        const restoredRoles = [];

        // Onceki rolleri geri ver
        const lastRoles = JSON.parse(userData.last_known_roles || '[]');
        for (const roleId of lastRoles) {
          const role = member.guild.roles.cache.get(roleId);
          if (role && role.id !== guildId && !role.managed) {
            try {
              markLegitimate(guildId, member.id);
              await member.roles.add(role);
              restoredRoles.push(roleId);
            } catch { /* */ }
          }
        }

        // Seviye rollerini kontrol et
        const levelRoles = await db.getLevelRoles(guildId);
        for (const type of ['ses', 'yazi']) {
          const userLevel = type === 'ses' ? userData.level_ses : userData.level_yazi;
          const qualified = levelRoles
            .filter(r => {
              const reqLevel = type === 'ses' ? r.ses_level : r.yazi_level;
              return reqLevel !== null && userLevel >= reqLevel;
            })
            .sort((a, b) => (type === 'ses' ? b.ses_level - a.ses_level : b.yazi_level - a.yazi_level))[0];

          if (qualified && !member.roles.cache.has(qualified.role_id)) {
            markLegitimate(guildId, member.id);
            await member.roles.add(qualified.role_id).catch(() => null);
            restoredRoles.push(qualified.role_id);
          }
        }

        // Baslangic rolu (0 sureli rol)
        const startRole = levelRoles.find(r => (r.ses_sure === 0 || r.ses_sure === null) && (r.yazi_sure === 0 || r.yazi_sure === null) && r.ses_level === 0 && r.yazi_level === 0);
        if (startRole && !member.roles.cache.has(startRole.role_id)) {
          markLegitimate(guildId, member.id);
          await member.roles.add(startRole.role_id).catch(() => null);
        }

        // DB guncelle
        const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
        userData.left_at = null;
        userData.last_leave_reason = null;
        userData.last_known_roles = '[]';
        userData.roles = JSON.stringify(freshMember ? freshMember.roles.cache.map(r => r.id) : []);
        cache.setUser(member.id, guildId, userData);

        await db.addRecord(member.id, guildId, 'Geri Dönüş', `${restoredRoles.length} rol geri verildi.`, 'SYSTEM');

        await log(client, guildId, LogTier.PERSONNEL, {
          title: '🔄 Personel Geri Döndü — Veriler Geri Yüklendi',
          description: `**${member.user.tag}** sunucuya geri döndü.`,
          targetId: member.id,
          fields: [
            { name: 'Seviyeler', value: `Ses: Lv.${userData.level_ses} | Yazı: Lv.${userData.level_yazi}`, inline: true },
            { name: 'Geri Verilen Roller', value: `${restoredRoles.length}`, inline: true },
          ],
        });
      } else {
        // YENI UYE
        const levelRoles = await db.getLevelRoles(guildId);
        const startRole = levelRoles.find(r => r.ses_level === 0 && r.yazi_level === 0);
        if (startRole) {
          markLegitimate(guildId, member.id);
          await member.roles.add(startRole.role_id).catch(() => null);
        }

        const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
        if (freshMember) {
          const newUserData = await cache.getUser(member.id, guildId);
          if (newUserData) {
            newUserData.roles = JSON.stringify(freshMember.roles.cache.map(r => r.id));
            cache.setUser(member.id, guildId, newUserData);
          }
        }

        await log(client, guildId, LogTier.PERSONNEL, {
          title: 'Yeni Personel Katıldı',
          description: `**${member.user.tag}** sunucuya katıldı.`,
          targetId: member.id,
        });
      }

      // Hosgeldin mesaji
      if (guildData?.welcome_enabled && guildData.welcome_message) {
        const msg = applyVars(guildData.welcome_message, member);
        if (guildData.welcome_send_dm) {
          await member.send(msg).catch(async () => {
            if (guildData.welcome_channel) {
              const ch = member.guild.channels.cache.get(guildData.welcome_channel);
              if (ch) await ch.send(msg).catch(() => null);
            }
          });
        } else if (guildData.welcome_channel) {
          const ch = member.guild.channels.cache.get(guildData.welcome_channel);
          if (ch) await ch.send(msg).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[guildMemberAdd] Hata:', err.message);
    }
  },
};

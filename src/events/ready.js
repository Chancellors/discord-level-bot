const { ActivityType, REST, Routes } = require('discord.js');
const config = require('../config');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { markLegitimate } = require('../systems/roleGuard');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Ready] ${client.user.tag} aktif! ${client.guilds.cache.size} sunucuda.`);

    client.user.setPresence({
      activities: [{ name: 'Mutlak Gözetim', type: ActivityType.Watching }],
      status: 'dnd',
    });

    // Slash komutlari kaydet
    const commands = client.commands.map(cmd => cmd.data.toJSON());
    const rest = new (require('@discordjs/rest').REST)().setToken(config.token);

    try {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log(`[Commands] ${commands.length} slash komutu kaydedildi.`);
    } catch (err) {
      console.error('[Commands] Komut kaydi basarisiz:', err);
    }

    // --- Bot acilisinda tum uyelerin rollerini senkronize et (Self-Healing) ---
    console.log('[RoleSync] Acilis senkronizasyonu baslatiliyor...');

    for (const [, guild] of client.guilds.cache) {
      try {
        const guildData = await Guild.findOne({ guildId: guild.id });
        if (!guildData) continue;

        // Seviye rol ID'lerini topla
        const levelRoleIds = new Set();
        guildData.levelRolesText.forEach(r => levelRoleIds.add(r.roleId));
        guildData.levelRolesVoice.forEach(r => levelRoleIds.add(r.roleId));

        if (levelRoleIds.size === 0) continue;

        const members = await guild.members.fetch();
        let fixCount = 0;

        for (const [, member] of members) {
          if (member.user.bot) continue;

          const userData = await User.findOne({ userId: member.id, guildId: guild.id });
          if (!userData) continue;

          // Hak edilen rolleri hesapla
          const earnedTextRoles = guildData.levelRolesText
            .filter(r => userData.levelText >= r.level)
            .map(r => r.roleId);
          const earnedVoiceRoles = guildData.levelRolesVoice
            .filter(r => userData.levelVoice >= r.level)
            .map(r => r.roleId);

          // En yuksek hak edilen rolleri bul
          const highestTextRole = guildData.levelRolesText
            .filter(r => userData.levelText >= r.level)
            .sort((a, b) => b.level - a.level)[0];
          const highestVoiceRole = guildData.levelRolesVoice
            .filter(r => userData.levelVoice >= r.level)
            .sort((a, b) => b.level - a.level)[0];

          const shouldHave = new Set();
          if (highestTextRole) shouldHave.add(highestTextRole.roleId);
          if (highestVoiceRole) shouldHave.add(highestVoiceRole.roleId);

          const currentRoles = member.roles.cache.map(r => r.id);
          let changed = false;

          // Hak edilmeyen seviye rollerini sil
          for (const roleId of currentRoles) {
            if (levelRoleIds.has(roleId) && !shouldHave.has(roleId)) {
              markLegitimate(guild.id, member.id);
              await member.roles.remove(roleId).catch(() => null);
              changed = true;
            }
          }

          // Eksik hak edilen rolleri ver
          for (const roleId of shouldHave) {
            if (!currentRoles.includes(roleId)) {
              markLegitimate(guild.id, member.id);
              await member.roles.add(roleId).catch(() => null);
              changed = true;
            }
          }

          // Yedegi guncelle
          if (changed) {
            fixCount++;
            const freshMember = await guild.members.fetch(member.id).catch(() => null);
            if (freshMember) {
              await User.updateOne(
                { userId: member.id, guildId: guild.id },
                { $set: { roles: freshMember.roles.cache.map(r => r.id) } }
              );
            }
          }
        }

        if (fixCount > 0) {
          console.log(`[RoleSync] ${guild.name}: ${fixCount} uye senkronize edildi.`);
        }
      } catch (err) {
        console.error(`[RoleSync] ${guild.name} hatasi:`, err.message);
      }
    }

    console.log('[RoleSync] Acilis senkronizasyonu tamamlandi.');
  },
};

const Guild = require('../models/Guild');
const User = require('../models/User');
const { log, LogTier } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    if (member.user.bot) return;

    try {
      const guildData = await Guild.findOne({ guildId: member.guild.id });
      if (!guildData) return;

      // Baslangic rollerini ver
      if (guildData.startingRoles?.length) {
        for (const roleId of guildData.startingRoles) {
          await member.roles.add(roleId).catch(() => null);
        }

        await log(client, member.guild.id, LogTier.PERSONNEL, {
          title: 'Yeni Personel Katıldı',
          description: `**${member.user.tag}** sunucuya katıldı. Başlangıç rolleri atandı.`,
          targetId: member.id,
          fields: [
            {
              name: 'Verilen Roller',
              value: guildData.startingRoles.map(r => `<@&${r}>`).join(', '),
              inline: false,
            },
          ],
        });
      }

      // Kullanici kaydini olustur ve rolleri yedekle
      const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
      if (freshMember) {
        await User.findOneAndUpdate(
          { userId: member.id, guildId: member.guild.id },
          {
            $setOnInsert: { userId: member.id, guildId: member.guild.id },
            $set: { roles: freshMember.roles.cache.map(r => r.id) },
          },
          { upsert: true }
        );
      }
    } catch (err) {
      console.error('[guildMemberAdd] Hata:', err.message);
    }
  },
};

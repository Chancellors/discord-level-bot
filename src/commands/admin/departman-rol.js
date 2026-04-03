const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../../models/Guild');
const User = require('../../models/User');
const { log, LogTier } = require('../../utils/logger');
const { markLegitimate } = require('../../systems/roleGuard');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('departman-rol')
    .setDescription('Seviye rollerini yönetin.')
    .addSubcommand(sub =>
      sub.setName('ata')
        .setDescription('Bir seviyeye rol ata.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Seviye numarası').setRequired(true).setMinValue(1))
        .addRoleOption(opt => opt.setName('rol').setDescription('Atanacak rol').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('sema')
        .setDescription('Tüm seviye rollerinin şemasını gösterir.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(false).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
    )
    .addSubcommand(sub =>
      sub.setName('ihrac')
        .setDescription('Bir seviyedeki rolü kaldır.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Kaldırılacak seviye').setRequired(true).setMinValue(1))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) {
      guildData = await Guild.create({ guildId });
    }

    if (sub === 'ata') {
      const hat = interaction.options.getString('hat');
      const seviye = interaction.options.getInteger('seviye');
      const rol = interaction.options.getRole('rol');

      const field = hat === 'text' ? 'levelRolesText' : 'levelRolesVoice';

      // Ayni seviyede zaten rol var mi?
      const existing = guildData[field].find(r => r.level === seviye);
      if (existing) {
        // Guncelle
        existing.roleId = rol.id;
        existing.name = rol.name;
      } else {
        guildData[field].push({ level: seviye, roleId: rol.id, name: rol.name });
      }

      // Seviyeye gore sirala
      guildData[field].sort((a, b) => a.level - b.level);
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Departman Rol Atandı',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Seviye', value: `${seviye}`, inline: true },
        ],
      });

      return interaction.reply({
        content: `✅ **${rol.name}** rolü, ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı **Lv.${seviye}** için atandı.`,
        ephemeral: true,
      });
    }

    if (sub === 'sema') {
      const hat = interaction.options.getString('hat');

      const buildSchema = (roles, title) => {
        if (!roles.length) return `**${title}:** Henüz rol tanımlı değil.`;
        return `**${title}:**\n` + roles.map(r => {
          const role = interaction.guild.roles.cache.get(r.roleId);
          return `Lv.**${r.level}** → ${role ? role.toString() : `\`${r.roleId}\` (Silinmiş?)`}`;
        }).join('\n');
      };

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📊 Evil Mega Corp // Departman Rol Şeması')
        .setTimestamp()
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' });

      if (!hat || hat === 'text') {
        embed.addFields({ name: '📝 Yazı Hattı', value: buildSchema(guildData.levelRolesText, 'Yazı'), inline: false });
      }
      if (!hat || hat === 'voice') {
        embed.addFields({ name: '🎙️ Ses Hattı', value: buildSchema(guildData.levelRolesVoice, 'Ses'), inline: false });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ihrac') {
      const hat = interaction.options.getString('hat');
      const seviye = interaction.options.getInteger('seviye');
      const field = hat === 'text' ? 'levelRolesText' : 'levelRolesVoice';

      const index = guildData[field].findIndex(r => r.level === seviye);
      if (index === -1) {
        return interaction.reply({ content: `❌ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı Lv.${seviye} için tanımlı rol bulunamadı.`, ephemeral: true });
      }

      const removed = guildData[field].splice(index, 1)[0];
      await guildData.save();

      await interaction.deferReply({ ephemeral: true });

      // --- AUTO-CLEANUP: Tum uyelerden bu rolu sil ---
      let cleanupCount = 0;
      try {
        const members = await interaction.guild.members.fetch();
        for (const [, member] of members) {
          if (member.roles.cache.has(removed.roleId)) {
            markLegitimate(guildId, member.id);
            await member.roles.remove(removed.roleId).catch(() => null);

            // Bir alt seviye rolunu ver (uyeyi rolsuz birakma)
            const remainingRoles = guildData[field].filter(r => {
              const userData = null; // async kontrol gerekiyor, asagida yapilacak
              return true;
            });

            cleanupCount++;
          }
        }

        // Her uyenin hak ettigi en yuksek rolu geri ver
        for (const [, member] of members) {
          if (member.user.bot) continue;
          const userData = await User.findOne({ userId: member.id, guildId });
          if (!userData) continue;

          const userLevel = hat === 'text' ? userData.levelText : userData.levelVoice;
          const highestRole = guildData[field]
            .filter(r => userLevel >= r.level)
            .sort((a, b) => b.level - a.level)[0];

          if (highestRole && !member.roles.cache.has(highestRole.roleId)) {
            markLegitimate(guildId, member.id);
            await member.roles.add(highestRole.roleId).catch(() => null);
          }

          // Yedegi guncelle
          const freshMember = await interaction.guild.members.fetch(member.id).catch(() => null);
          if (freshMember) {
            await User.updateOne(
              { userId: member.id, guildId },
              { $set: { roles: freshMember.roles.cache.map(r => r.id) } }
            );
          }
        }
      } catch (err) {
        console.error('[AutoCleanup] Hata:', err.message);
      }

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Departman Rol İhraç Edildi (Toplu Temizlik)',
        operatorId: interaction.user.id,
        roleId: removed.roleId,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Seviye', value: `${seviye}`, inline: true },
          { name: 'Temizlenen Üye', value: `${cleanupCount}`, inline: true },
        ],
      });

      return interaction.editReply({
        content: `✅ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı **Lv.${seviye}** rolü kaldırıldı.\n🧹 **${cleanupCount}** üyeden rol temizlendi ve alt seviye rolleri güncellendi.`,
      });
    }
  },
};

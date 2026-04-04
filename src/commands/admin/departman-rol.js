const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const queries = require('../../database/queries');
const { formatDuration } = require('../../utils/timeParser');
const { log, LogTier } = require('../../utils/logger');
const { markLegitimate } = require('../../systems/roleGuard');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('departman-rol')
    .setDescription('Seviye rollerini yönet.')
    .addSubcommand(sub => sub.setName('sema').setDescription('Tüm seviye rollerini hiyerarşi olarak göster.'))
    .addSubcommand(sub =>
      sub.setName('ihrac')
        .setDescription('Bir seviye rol tanımını kaldır.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Kaldırılacak rol').setRequired(true)))
    .addSubcommand(sub => sub.setName('toplu-ata').setDescription('Tüm üyelere mevcut XP\'lerine göre doğru rolleri ata.'))
    .addSubcommand(sub =>
      sub.setName('kontrol')
        .setDescription('Bir kullanıcının hangi role hak kazandığını kontrol et.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kontrol edilecek kullanıcı').setRequired(true)))
    .addSubcommand(sub => sub.setName('temizle').setDescription('TÜM seviye rol tanımlarını sil.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'sema') {
      const roles = await queries.getLevelRoles(guildId);
      if (!roles || roles.length === 0) {
        return interaction.reply({ content: '📭 Henüz tanımlı seviye rolü yok.', ephemeral: true });
      }

      const sorted = roles.sort((a, b) => (b.ses_level + b.yazi_level) - (a.ses_level + a.yazi_level));
      const lines = sorted.map((r, i) => {
        const prefix = i === sorted.length - 1 ? '└' : '├';
        const sesInfo = r.ses_sure ? `🎙️ ${formatDuration(r.ses_sure)} (Lv.${r.ses_level})` : '';
        const yaziInfo = r.yazi_sure ? `📝 ${formatDuration(r.yazi_sure)} (Lv.${r.yazi_level})` : '';
        const modInfo = r.mod === 'birlesik' ? ' [Birleşik]' : '';
        const isStarter = r.ses_level === 0 && r.yazi_level === 0;
        const details = isStarter ? '⭐ Başlangıç Rolü' : [sesInfo, yaziInfo].filter(Boolean).join(' | ');
        return `${prefix} <@&${r.role_id}> — ${details}${modInfo}`;
      });

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🏢 Evil Mega Corp // Departman Şeması')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Toplam ${roles.length} rol tanımlı` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'ihrac') {
      const role = interaction.options.getRole('rol');
      await queries.removeLevelRole(guildId, role.id);
      await interaction.reply({ content: `✅ **${role.name}** seviye rol tanımı kaldırıldı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Rol Tanımı Kaldırıldı',
        description: `${role.name} seviye rol tanımı silindi.`,
        operatorId: interaction.user.id,
        roleId: role.id,
      });
      return;
    }

    if (sub === 'toplu-ata') {
      await interaction.deferReply({ ephemeral: true });

      const levelRoles = await queries.getLevelRoles(guildId);
      if (!levelRoles || levelRoles.length === 0) {
        return interaction.editReply({ content: '📭 Tanımlı seviye rolü yok.' });
      }

      const members = await interaction.guild.members.fetch();
      let atanan = 0;
      let hata = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;

        try {
          const userData = await queries.getUser(member.id, guildId);
          if (!userData) continue;

          const sesLevel = userData.level_ses || 0;
          const yaziLevel = userData.level_yazi || 0;

          let bestRole = null;
          let bestScore = -1;

          for (const lr of levelRoles) {
            if (lr.mod === 'birlesik') {
              const combined = sesLevel + yaziLevel;
              const required = lr.ses_level + lr.yazi_level;
              if (combined >= required && required > bestScore) {
                bestScore = required;
                bestRole = lr;
              }
            } else {
              const qualifySes = lr.ses_level === 0 || sesLevel >= lr.ses_level;
              const qualifyYazi = lr.yazi_level === 0 || yaziLevel >= lr.yazi_level;
              const score = lr.ses_level + lr.yazi_level;
              if ((qualifySes || qualifyYazi) && score > bestScore) {
                bestScore = score;
                bestRole = lr;
              }
            }
          }

          // Also assign starter roles (level 0)
          const starterRoles = levelRoles.filter(lr => lr.ses_level === 0 && lr.yazi_level === 0);
          for (const sr of starterRoles) {
            if (!member.roles.cache.has(sr.role_id)) {
              markLegitimate(guildId, sr.role_id);
              await member.roles.add(sr.role_id).catch(() => {});
            }
          }

          if (bestRole && !member.roles.cache.has(bestRole.role_id)) {
            markLegitimate(guildId, bestRole.role_id);
            await member.roles.add(bestRole.role_id).catch(() => { hata++; });
            atanan++;
          }
        } catch {
          hata++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle('✅ Toplu Rol Atama Tamamlandı')
        .addFields(
          { name: 'Taranan Üye', value: `${members.filter(m => !m.user.bot).size}`, inline: true },
          { name: 'Rol Atanan', value: `${atanan}`, inline: true },
          { name: 'Hata', value: `${hata}`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Toplu Atama' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Toplu Rol Atama',
        description: `${atanan} üyeye rol atandı. ${hata} hata.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'kontrol') {
      const user = interaction.options.getUser('kullanici');
      const userData = await queries.getUser(user.id, guildId);
      if (!userData) {
        return interaction.reply({ content: '❌ Bu kullanıcının verisi bulunamadı.', ephemeral: true });
      }

      const levelRoles = await queries.getLevelRoles(guildId);
      const sesLevel = userData.level_ses || 0;
      const yaziLevel = userData.level_yazi || 0;

      const qualified = levelRoles.filter(lr => {
        if (lr.ses_level === 0 && lr.yazi_level === 0) return true;
        if (lr.mod === 'birlesik') return (sesLevel + yaziLevel) >= (lr.ses_level + lr.yazi_level);
        return (lr.ses_level > 0 && sesLevel >= lr.ses_level) || (lr.yazi_level > 0 && yaziLevel >= lr.yazi_level);
      });

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`🔍 Rol Kontrol: ${user.username}`)
        .addFields(
          { name: '🎙️ Ses Seviyesi', value: `${sesLevel}`, inline: true },
          { name: '📝 Yazı Seviyesi', value: `${yaziLevel}`, inline: true },
          { name: '✅ Hak Kazanılan Roller', value: qualified.length > 0 ? qualified.map(r => `<@&${r.role_id}>`).join(', ') : 'Yok', inline: false },
        )
        .setFooter({ text: 'Evil Mega Corp // Rol Kontrol' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'temizle') {
      const roles = await queries.getLevelRoles(guildId);
      if (!roles || roles.length === 0) {
        return interaction.reply({ content: '📭 Silinecek rol tanımı yok.', ephemeral: true });
      }

      for (const r of roles) {
        await queries.removeLevelRole(guildId, r.role_id);
      }

      await interaction.reply({ content: `✅ **${roles.length}** seviye rol tanımı silindi.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Tüm Rol Tanımları Silindi',
        description: `${roles.length} rol tanımı temizlendi.`,
        operatorId: interaction.user.id,
      });
    }
  },
};

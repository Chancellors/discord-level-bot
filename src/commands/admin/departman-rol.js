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
    )
    .addSubcommand(sub =>
      sub.setName('toplu-ata')
        .setDescription('Tüm üyelere hak ettikleri seviye rollerini toplu ata.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }, { name: 'Her İkisi', value: 'both' }))
    )
    .addSubcommand(sub =>
      sub.setName('kontrol')
        .setDescription('Seviye-rol uyumsuzluklarını tespit et (düzeltmeden).')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
    )
    .addSubcommand(sub =>
      sub.setName('temizle')
        .setDescription('Bir hattaki TÜM seviye rollerini sıfırla.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addStringOption(opt => opt.setName('onay').setDescription('"ONAYLA" yazın').setRequired(true))
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

      const existing = guildData[field].find(r => r.level === seviye);
      if (existing) {
        existing.roleId = rol.id;
        existing.name = rol.name;
      } else {
        guildData[field].push({ level: seviye, roleId: rol.id, name: rol.name });
      }

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
        return `**${title}:**\n` + roles.map((r, i) => {
          const role = interaction.guild.roles.cache.get(r.roleId);
          const arrow = i < roles.length - 1 ? '├' : '└';
          return `${arrow} Lv.**${r.level}** → ${role ? role.toString() : `\`${r.roleId}\` (Silinmiş?)`}`;
        }).join('\n');
      };

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📊 Evil Mega Corp // Departman Rol Şeması')
        .setTimestamp()
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' });

      if (!hat || hat === 'text') {
        embed.addFields({
          name: `📝 Yazı Hattı (${guildData.levelRolesText.length} kademe)`,
          value: buildSchema(guildData.levelRolesText, 'Yazı'),
          inline: false,
        });
      }
      if (!hat || hat === 'voice') {
        embed.addFields({
          name: `🎙️ Ses Hattı (${guildData.levelRolesVoice.length} kademe)`,
          value: buildSchema(guildData.levelRolesVoice, 'Ses'),
          inline: false,
        });
      }

      // Toplam atanan seviye sayisi
      const totalRoles = guildData.levelRolesText.length + guildData.levelRolesVoice.length;
      embed.addFields({
        name: '📈 Özet',
        value: `Toplam **${totalRoles}** kademe tanımlı.`,
        inline: false,
      });

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

    if (sub === 'toplu-ata') {
      const hat = interaction.options.getString('hat');
      await interaction.deferReply({ ephemeral: true });

      const hats = hat === 'both' ? ['text', 'voice'] : [hat];
      let totalUpdated = 0;
      let totalSkipped = 0;

      for (const h of hats) {
        const field = h === 'text' ? 'levelRolesText' : 'levelRolesVoice';
        const roleList = guildData[field];
        if (!roleList.length) continue;

        const members = await interaction.guild.members.fetch();
        for (const [, member] of members) {
          if (member.user.bot) continue;

          const userData = await User.findOne({ userId: member.id, guildId });
          if (!userData) { totalSkipped++; continue; }

          const userLevel = h === 'text' ? userData.levelText : userData.levelVoice;

          // Hak ettigi en yuksek rol
          const qualifiedRole = roleList
            .filter(r => userLevel >= r.level)
            .sort((a, b) => b.level - a.level)[0];

          if (!qualifiedRole) continue;

          // Daha dusuk rolleri kaldir
          for (const r of roleList) {
            if (r.roleId !== qualifiedRole.roleId && member.roles.cache.has(r.roleId)) {
              markLegitimate(guildId, member.id);
              await member.roles.remove(r.roleId).catch(() => null);
            }
          }

          // Hak ettigi rolu ekle
          if (!member.roles.cache.has(qualifiedRole.roleId)) {
            markLegitimate(guildId, member.id);
            await member.roles.add(qualifiedRole.roleId).catch(() => null);
            totalUpdated++;
          }

          // Rol yedegini guncelle
          const freshMember = await interaction.guild.members.fetch(member.id).catch(() => null);
          if (freshMember) {
            await User.updateOne(
              { userId: member.id, guildId },
              { $set: { roles: freshMember.roles.cache.map(r => r.id) } }
            );
          }
        }
      }

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Toplu Rol Atama Tamamlandı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Hat', value: hat === 'both' ? 'Yazı + Ses' : (hat === 'text' ? 'Yazı' : 'Ses'), inline: true },
          { name: 'Güncellenen', value: `${totalUpdated}`, inline: true },
          { name: 'Atlanan', value: `${totalSkipped}`, inline: true },
        ],
      });

      return interaction.editReply({
        content: `✅ Toplu rol atama tamamlandı.\n📊 **${totalUpdated}** üye güncellendi, **${totalSkipped}** üye atlandı (kayıt yok).`,
      });
    }

    if (sub === 'kontrol') {
      const hat = interaction.options.getString('hat');
      await interaction.deferReply({ ephemeral: true });

      const field = hat === 'text' ? 'levelRolesText' : 'levelRolesVoice';
      const roleList = guildData[field];

      if (!roleList.length) {
        return interaction.editReply({ content: `❌ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı için tanımlı rol yok.` });
      }

      const mismatches = [];
      const members = await interaction.guild.members.fetch();

      for (const [, member] of members) {
        if (member.user.bot) continue;

        const userData = await User.findOne({ userId: member.id, guildId });
        if (!userData) continue;

        const userLevel = hat === 'text' ? userData.levelText : userData.levelVoice;
        const qualifiedRole = roleList
          .filter(r => userLevel >= r.level)
          .sort((a, b) => b.level - a.level)[0];

        // Mevcut seviye rolleri
        const currentLevelRoles = roleList.filter(r => member.roles.cache.has(r.roleId));

        const hasCorrectRole = qualifiedRole && member.roles.cache.has(qualifiedRole.roleId);
        const hasExtraRoles = currentLevelRoles.length > 1;
        const missingRole = qualifiedRole && !hasCorrectRole;

        if (missingRole || hasExtraRoles) {
          const expected = qualifiedRole ? `Lv.${qualifiedRole.level}` : 'Yok';
          const current = currentLevelRoles.map(r => `Lv.${r.level}`).join(', ') || 'Yok';
          mismatches.push(`<@${member.id}> — Beklenen: **${expected}** | Mevcut: **${current}**`);
        }

        if (mismatches.length >= 20) break; // Limit
      }

      if (!mismatches.length) {
        return interaction.editReply({ content: `✅ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattında uyumsuzluk bulunamadı.` });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.security)
        .setTitle(`⚠️ Rol Uyumsuzluk Raporu — ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı`)
        .setDescription(mismatches.join('\n'))
        .setFooter({ text: `${mismatches.length} uyumsuzluk tespit edildi • Düzeltmek için /departman-rol toplu-ata` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'temizle') {
      const hat = interaction.options.getString('hat');
      const onay = interaction.options.getString('onay');

      if (onay !== 'ONAYLA') {
        return interaction.reply({ content: '⚠️ Bu işlem geri alınamaz! Onaylamak için `ONAYLA` yazın.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const field = hat === 'text' ? 'levelRolesText' : 'levelRolesVoice';
      const roleList = [...guildData[field]];
      const removedCount = roleList.length;

      // Tum uyelerden bu rolleri kaldir
      let cleanupCount = 0;
      try {
        const members = await interaction.guild.members.fetch();
        for (const [, member] of members) {
          for (const r of roleList) {
            if (member.roles.cache.has(r.roleId)) {
              markLegitimate(guildId, member.id);
              await member.roles.remove(r.roleId).catch(() => null);
              cleanupCount++;
            }
          }
        }
      } catch (err) {
        console.error('[BulkCleanup] Hata:', err.message);
      }

      guildData[field] = [];
      await guildData.save();

      await log(interaction.client, guildId, LogTier.SECURITY, {
        title: 'Departman Rol Şeması Sıfırlandı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Kaldırılan Kademe', value: `${removedCount}`, inline: true },
          { name: 'Temizlenen Rol', value: `${cleanupCount}`, inline: true },
        ],
      });

      return interaction.editReply({
        content: `✅ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı rol şeması tamamen sıfırlandı.\n🗑️ **${removedCount}** kademe silindi, **${cleanupCount}** rol üyelerden kaldırıldı.`,
      });
    }
  },
};

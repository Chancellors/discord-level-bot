const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const { markLegitimate } = require('../../systems/roleGuard');
const { checkLevelUp, xpForLevel } = require('../../systems/xpEngine');
const notifications = require('../../utils/notifications');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('kullanici-yonet')
    .setDescription('Personel üzerinde yönetimsel işlemler yapın.')
    .addSubcommand(sub =>
      sub.setName('seviye-ayarla')
        .setDescription('Bir üyenin seviyesini zorla değiştirir ve rollerini günceller.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Yeni seviye').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('xp-ayarla')
        .setDescription('Bir üyenin XP miktarını belirli bir değere sabitler.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('miktar').setDescription('XP miktarı').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('xp-ekle')
        .setDescription('Bir üyeye XP ekler (mevcut XP\'ye eklenir).')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('miktar').setDescription('Eklenecek XP').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('xp-sil')
        .setDescription('Bir üyeden XP düşer (mevcut XP\'den çıkarılır).')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('miktar').setDescription('Düşülecek XP').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('dondur')
        .setDescription('Kullanıcının XP kazanımını dondurur veya çözer.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addIntegerOption(opt => opt.setName('sure').setDescription('Dondurma süresi (saat). Boş = süresiz.').setRequired(false).setMinValue(1))
        .addStringOption(opt => opt.setName('sebep').setDescription('Dondurma sebebi').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('sicil-isle')
        .setDescription('Kullanıcının siciline disiplin kaydı ekler.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('islem').setDescription('İşlem türü').setRequired(true).addChoices(
          { name: 'Uyarı', value: 'Uyarı' },
          { name: 'Kınama', value: 'Kınama' },
          { name: 'İhtar', value: 'İhtar' },
          { name: 'Ceza Puanı', value: 'Ceza Puanı' },
          { name: 'Not', value: 'Not' },
          { name: 'Ödül', value: 'Ödül' }
        ))
        .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('sicil-sorgula')
        .setDescription('Kullanıcının tüm sicil geçmişini sorgular.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Kullanıcının tüm verilerini sıfırlar (GERİ ALINAMAZ!).')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('onay').setDescription('"ONAYLA" yazarak işlemi doğrulayın').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // --- SEVIYE AYARLA ---
    if (sub === 'seviye-ayarla') {
      const target = interaction.options.getUser('kullanici');
      const hat = interaction.options.getString('hat');
      const seviye = interaction.options.getInteger('seviye');
      const levelField = hat === 'text' ? 'levelText' : 'levelVoice';
      const xpField = hat === 'text' ? 'xpText' : 'xpVoice';

      const oldData = await User.findOne({ userId: target.id, guildId });
      const oldLevel = oldData?.[levelField] || 0;

      await User.findOneAndUpdate(
        { userId: target.id, guildId },
        { $set: { [levelField]: seviye, [xpField]: 0 }, $setOnInsert: { userId: target.id, guildId } },
        { upsert: true, new: true }
      );

      // Rol guncelleme
      const guildData = await Guild.findOne({ guildId });
      const roleList = hat === 'text' ? guildData?.levelRolesText : guildData?.levelRolesVoice;

      if (roleList?.length) {
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member) {
          markLegitimate(guildId, target.id);

          // Tum seviye rollerini sil
          for (const r of roleList) {
            await member.roles.remove(r.roleId).catch(() => null);
          }

          // Yeni seviye rolunu ekle
          const newRoleEntry = roleList.filter(r => r.level <= seviye).sort((a, b) => b.level - a.level)[0];
          if (newRoleEntry) {
            await member.roles.add(newRoleEntry.roleId).catch(() => null);
          }

          // Yedegi guncelle
          const freshMember = await interaction.guild.members.fetch(target.id).catch(() => null);
          if (freshMember) {
            await User.updateOne({ userId: target.id, guildId }, { $set: { roles: freshMember.roles.cache.map(r => r.id) } });
          }

          // Bildirim gonder
          const oldRoleEntry = roleList.filter(r => r.level <= oldLevel).sort((a, b) => b.level - a.level)[0];
          const oldRoleName = oldRoleEntry ? (interaction.guild.roles.cache.get(oldRoleEntry.roleId)?.name || 'Yok') : 'Yok';
          const newRoleName = newRoleEntry ? (interaction.guild.roles.cache.get(newRoleEntry.roleId)?.name || 'Yok') : 'Yok';
          await notifications.sendLevelUp(interaction.client, guildId, target, hat, oldLevel, seviye, oldRoleName, newRoleName);
        }
      }

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Manuel Seviye Ayarı',
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Eski Seviye', value: `${oldLevel}`, inline: true },
          { name: 'Yeni Seviye', value: `${seviye}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ **${target.username}** ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı: Lv.**${oldLevel}** → Lv.**${seviye}**`, ephemeral: true });
    }

    // --- XP AYARLA ---
    if (sub === 'xp-ayarla') {
      const target = interaction.options.getUser('kullanici');
      const hat = interaction.options.getString('hat');
      const miktar = interaction.options.getInteger('miktar');
      const xpField = hat === 'text' ? 'xpText' : 'xpVoice';

      await User.findOneAndUpdate(
        { userId: target.id, guildId },
        { $set: { [xpField]: miktar }, $setOnInsert: { userId: target.id, guildId } },
        { upsert: true, new: true }
      );

      const userData = await User.findOne({ userId: target.id, guildId });
      await checkLevelUp(interaction.client, userData, hat, interaction.guild, target);

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Manuel XP Ayarı',
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'XP', value: `${miktar}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ **${target.username}** ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı XP → **${miktar}**`, ephemeral: true });
    }

    // --- XP EKLE ---
    if (sub === 'xp-ekle') {
      const target = interaction.options.getUser('kullanici');
      const hat = interaction.options.getString('hat');
      const miktar = interaction.options.getInteger('miktar');
      const xpField = hat === 'text' ? 'xpText' : 'xpVoice';

      const userData = await User.findOneAndUpdate(
        { userId: target.id, guildId },
        { $inc: { [xpField]: miktar }, $setOnInsert: { userId: target.id, guildId } },
        { upsert: true, new: true }
      );

      await checkLevelUp(interaction.client, userData, hat, interaction.guild, target);

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Manuel XP Ekleme',
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Eklenen', value: `+${miktar} XP`, inline: true },
          { name: 'Yeni Toplam', value: `${userData[xpField]} XP`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ **${target.username}** ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı: **+${miktar}** XP eklendi. (Toplam: ${userData[xpField]})`, ephemeral: true });
    }

    // --- XP SIL ---
    if (sub === 'xp-sil') {
      const target = interaction.options.getUser('kullanici');
      const hat = interaction.options.getString('hat');
      const miktar = interaction.options.getInteger('miktar');
      const xpField = hat === 'text' ? 'xpText' : 'xpVoice';

      const userData = await User.findOneAndUpdate(
        { userId: target.id, guildId },
        { $inc: { [xpField]: -miktar }, $setOnInsert: { userId: target.id, guildId } },
        { upsert: true, new: true }
      );

      // XP eksi olmasin
      if (userData[xpField] < 0) {
        await User.updateOne({ userId: target.id, guildId }, { $set: { [xpField]: 0 } });
      }

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Manuel XP Silme',
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Düşülen', value: `-${miktar} XP`, inline: true },
          { name: 'Yeni Toplam', value: `${Math.max(0, userData[xpField])} XP`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ **${target.username}** ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı: **-${miktar}** XP düşüldü. (Toplam: ${Math.max(0, userData[xpField])})`, ephemeral: true });
    }

    // --- DONDUR ---
    if (sub === 'dondur') {
      const target = interaction.options.getUser('kullanici');
      const sure = interaction.options.getInteger('sure');
      const sebep = interaction.options.getString('sebep') || 'Belirtilmedi';

      const userData = await User.findOne({ userId: target.id, guildId });
      const newFrozen = !(userData?.frozen);
      const frozenUntil = (newFrozen && sure) ? new Date(Date.now() + sure * 3600_000) : null;

      await User.findOneAndUpdate(
        { userId: target.id, guildId },
        {
          $set: {
            frozen: newFrozen,
            frozenBy: newFrozen ? interaction.user.id : null,
            frozenAt: newFrozen ? new Date() : null,
            frozenUntil,
          },
          $setOnInsert: { userId: target.id, guildId },
        },
        { upsert: true }
      );

      const sureText = sure ? `${sure} saat` : 'Süresiz';

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: newFrozen ? 'Personel Donduruldu' : 'Personel Çözüldü',
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'Sebep', value: sebep, inline: true },
          { name: 'Süre', value: newFrozen ? sureText : 'N/A', inline: true },
        ],
      });

      return interaction.reply({
        content: newFrozen
          ? `❄️ **${target.username}** donduruldu (${sureText}). XP kazanımı durduruldu.\n📋 Sebep: ${sebep}`
          : `✅ **${target.username}** çözüldü. XP kazanımı tekrar aktif.`,
        ephemeral: true,
      });
    }

    // --- SICIL ISLE ---
    if (sub === 'sicil-isle') {
      const target = interaction.options.getUser('kullanici');
      const islem = interaction.options.getString('islem');
      const sebep = interaction.options.getString('sebep');

      await User.findOneAndUpdate(
        { userId: target.id, guildId },
        {
          $push: { records: { action: islem, reason: sebep, operatorId: interaction.user.id } },
          $setOnInsert: { userId: target.id, guildId },
        },
        { upsert: true }
      );

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Sicil Kaydı Eklendi',
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'İşlem', value: islem, inline: true },
          { name: 'Sebep', value: sebep, inline: false },
        ],
      });

      const emoji = { 'Uyarı': '⚠️', 'Kınama': '🟠', 'İhtar': '🔴', 'Ceza Puanı': '❌', 'Not': '📝', 'Ödül': '🏆' };
      return interaction.reply({ content: `${emoji[islem] || '📋'} **${target.username}** siciline **${islem}** kaydedildi: ${sebep}`, ephemeral: true });
    }

    // --- SICIL SORGULA ---
    if (sub === 'sicil-sorgula') {
      const target = interaction.options.getUser('kullanici');
      const userData = await User.findOne({ userId: target.id, guildId });

      if (!userData || !userData.records.length) {
        return interaction.reply({ content: `📋 **${target.username}** sicilinde kayıt bulunmamaktadır.`, ephemeral: true });
      }

      const records = userData.records.slice(-15).reverse();
      const emoji = { 'Uyarı': '⚠️', 'Kınama': '🟠', 'İhtar': '🔴', 'Ceza Puanı': '❌', 'Not': '📝', 'Ödül': '🏆' };

      const recordLines = records.map((r, i) => {
        const timeStr = r.timestamp ? `<t:${Math.floor(r.timestamp.getTime() / 1000)}:R>` : 'Bilinmiyor';
        return `**${records.length - i}.** ${emoji[r.action] || '📋'} **${r.action}** — ${r.reason}\n   ↳ Operatör: <@${r.operatorId}> | ${timeStr}`;
      });

      // Ozet istatistikleri
      const summary = {};
      userData.records.forEach(r => { summary[r.action] = (summary[r.action] || 0) + 1; });
      const summaryText = Object.entries(summary).map(([k, v]) => `${emoji[k] || '📋'} ${k}: **${v}**`).join(' | ');

      const embed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle(`📁 Evil Mega Corp // Sicil Raporu — ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Toplam Kayıt:** ${userData.records.length}\n${summaryText}\n\n${recordLines.join('\n\n')}`)
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- SIFIRLA ---
    if (sub === 'sifirla') {
      const target = interaction.options.getUser('kullanici');
      const onay = interaction.options.getString('onay');

      if (onay !== 'ONAYLA') {
        return interaction.reply({ content: '❌ Onay kodu hatalı. Bu işlemi gerçekleştirmek için `ONAYLA` yazmanız gerekiyor.', ephemeral: true });
      }

      // Eski veriyi logla
      const oldData = await User.findOne({ userId: target.id, guildId });
      if (!oldData) {
        return interaction.reply({ content: '❌ Bu kullanıcıya ait veri bulunamadı.', ephemeral: true });
      }

      // Seviye rollerini sil
      const guildData = await Guild.findOne({ guildId });
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member && guildData) {
        markLegitimate(guildId, target.id);
        const allLevelRoles = [
          ...(guildData.levelRolesText || []).map(r => r.roleId),
          ...(guildData.levelRolesVoice || []).map(r => r.roleId),
        ];
        for (const roleId of allLevelRoles) {
          await member.roles.remove(roleId).catch(() => null);
        }
      }

      // Veriyi sifirla
      await User.updateOne(
        { userId: target.id, guildId },
        {
          $set: {
            xpText: 0, xpVoice: 0,
            levelText: 0, levelVoice: 0,
            totalMessagesText: 0, totalMinutesVoice: 0,
            frozen: false, frozenBy: null, frozenAt: null, frozenUntil: null,
            prestigeHistory: [], records: [], taxHistory: [],
            cardTheme: 'default', cardColor: '#ffffff', unlockedThemes: [],
          },
        }
      );

      // Yedegi guncelle
      if (member) {
        await User.updateOne({ userId: target.id, guildId }, { $set: { roles: member.roles.cache.map(r => r.id) } });
      }

      await log(interaction.client, guildId, LogTier.SECURITY, {
        title: 'Personel Verileri SIFIRLANDI',
        description: `**${target.username}** kullanıcısının tüm verileri geri dönüşümsüz olarak sıfırlandı.`,
        operatorId: interaction.user.id,
        targetId: target.id,
        fields: [
          { name: 'Eski Yazı Seviyesi', value: `${oldData.levelText}`, inline: true },
          { name: 'Eski Ses Seviyesi', value: `${oldData.levelVoice}`, inline: true },
          { name: 'Sicil Kayıtları', value: `${oldData.records.length} kayıt silindi`, inline: true },
        ],
      });

      return interaction.reply({ content: `🗑️ **${target.username}** kullanıcısının tüm verileri sıfırlandı. Bu işlem geri alınamaz.`, ephemeral: true });
    }
  },
};

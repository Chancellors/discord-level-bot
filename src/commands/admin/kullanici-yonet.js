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
    .setDescription('Personel üzerinde yönetimsel işlemler.')
    .addSubcommand(sub =>
      sub.setName('seviye-ayarla')
        .setDescription('Kullanıcının seviyesini ayarla.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Yeni seviye').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('xp-ayarla')
        .setDescription('Kullanıcının XP miktarını ayarla.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addIntegerOption(opt => opt.setName('miktar').setDescription('XP miktarı').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('dondur')
        .setDescription('Kullanıcının XP kazanımını dondur/çöz.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addIntegerOption(opt => opt.setName('sure').setDescription('Dondurma süresi (saat). Boş bırakılırsa süresiz.').setRequired(false).setMinValue(1))
        .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('sicil-isle')
        .setDescription('Kullanıcının siciline kayıt ekle.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('islem').setDescription('İşlem türü').setRequired(true).addChoices(
          { name: 'Uyarı', value: 'Uyarı' },
          { name: 'Kınama', value: 'Kınama' },
          { name: 'İhtar', value: 'İhtar' },
          { name: 'Not', value: 'Not' }
        ))
        .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'seviye-ayarla') {
      const target = interaction.options.getUser('kullanici');
      const hat = interaction.options.getString('hat');
      const seviye = interaction.options.getInteger('seviye');
      const levelField = hat === 'text' ? 'levelText' : 'levelVoice';
      const xpField = hat === 'text' ? 'xpText' : 'xpVoice';

      const userData = await User.findOneAndUpdate(
        { userId: target.id, guildId },
        { $set: { [levelField]: seviye, [xpField]: 0 }, $setOnInsert: { userId: target.id, guildId } },
        { upsert: true, new: true }
      );

      const oldLevel = userData[levelField];

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
          const newRoleEntry = roleList.filter(r => r.level <= seviye).pop();
          if (newRoleEntry) {
            await member.roles.add(newRoleEntry.roleId).catch(() => null);
          }

          // Yedegi guncelle
          const freshMember = await interaction.guild.members.fetch(target.id).catch(() => null);
          if (freshMember) {
            await User.updateOne({ userId: target.id, guildId }, { $set: { roles: freshMember.roles.cache.map(r => r.id) } });
          }

          // Bildirim gonder
          const oldRoleEntry = roleList.filter(r => r.level <= oldLevel).pop();
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
          { name: 'Yeni Seviye', value: `${seviye}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ **${target.username}** ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı seviyesi **Lv.${seviye}** olarak ayarlandı.`, ephemeral: true });
    }

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

      // Seviye atlama kontrolu
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

      return interaction.reply({ content: `✅ **${target.username}** ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı XP'si **${miktar}** olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'dondur') {
      const target = interaction.options.getUser('kullanici');
      const sure = interaction.options.getInteger('sure'); // saat cinsinden
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
          ? `❄️ **${target.username}** donduruldu (${sureText}). XP kazanımı durduruldu. Sebep: ${sebep}`
          : `✅ **${target.username}** çözüldü. XP kazanımı tekrar aktif.`,
        ephemeral: true,
      });
    }

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

      return interaction.reply({ content: `✅ **${target.username}** siciline **${islem}** kaydedildi: ${sebep}`, ephemeral: true });
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const { xpForLevel } = require('../../systems/xpEngine');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Kullanıcı seviye kartını ve istatistiklerini gösterir.')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Görüntülenecek kullanıcı').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('gorunum')
        .setDescription('Kart görünümü')
        .setRequired(false)
        .addChoices(
          { name: 'Özet', value: 'ozet' },
          { name: 'Detay', value: 'detay' }
        )
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const viewMode = interaction.options.getString('gorunum') || 'ozet';

    const userData = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
    if (!userData) {
      return interaction.reply({ content: '📋 Bu personelin kayıtlarında henüz veri bulunmamaktadır.', ephemeral: true });
    }

    const guildData = await Guild.findOne({ guildId: interaction.guild.id });

    // Siralama hesapla
    const textRank = await User.countDocuments({
      guildId: interaction.guild.id,
      xpText: { $gt: userData.xpText },
    }) + 1;

    const voiceRank = await User.countDocuments({
      guildId: interaction.guild.id,
      xpVoice: { $gt: userData.xpVoice },
    }) + 1;

    // Mevcut rol isimlerini bul
    const textRoleEntry = guildData?.levelRolesText?.filter(r => r.level <= userData.levelText).pop();
    const voiceRoleEntry = guildData?.levelRolesVoice?.filter(r => r.level <= userData.levelVoice).pop();
    const textRoleName = textRoleEntry ? (interaction.guild.roles.cache.get(textRoleEntry.roleId)?.name || textRoleEntry.name) : 'Personel';
    const voiceRoleName = voiceRoleEntry ? (interaction.guild.roles.cache.get(voiceRoleEntry.roleId)?.name || voiceRoleEntry.name) : 'Personel';

    const textXpNeeded = xpForLevel(userData.levelText);
    const voiceXpNeeded = xpForLevel(userData.levelVoice);

    // Progress bar olustur
    const makeBar = (current, max) => {
      const filled = Math.round((current / max) * 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
      .setAuthor({ name: `${targetUser.username} // Personel Dosyası`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: 'Evil Mega Corp // Surveillance Division' })
      .setTimestamp();

    // Yazi Hatti
    embed.addFields(
      { name: '📝 Yazı Hattı', value: `**Rütbe:** ${textRoleName}\n**Seviye:** ${userData.levelText}\n**XP:** ${userData.xpText}/${textXpNeeded}\n${makeBar(userData.xpText, textXpNeeded)}\n**Sıralama:** #${textRank}`, inline: true },
      { name: '🎙️ Ses Hattı', value: `**Rütbe:** ${voiceRoleName}\n**Seviye:** ${userData.levelVoice}\n**XP:** ${userData.xpVoice}/${voiceXpNeeded}\n${makeBar(userData.xpVoice, voiceXpNeeded)}\n**Sıralama:** #${voiceRank}`, inline: true },
    );

    if (viewMode === 'detay') {
      embed.addFields(
        { name: '📊 İstatistikler', value: `**Toplam Mesaj:** ${userData.totalMessagesText}\n**Toplam Ses (dk):** ${userData.totalMinutesVoice}\n**Dondurulan:** ${userData.frozen ? '❄️ Evet' : '✅ Hayır'}`, inline: false },
      );

      if (userData.prestigeHistory.length > 0) {
        const lastPrestige = userData.prestigeHistory.slice(-3).reverse();
        const historyText = lastPrestige.map(p =>
          `${p.type === 'text' ? '📝' : '🎙️'} Lv.${p.oldLevel} → Lv.${p.newLevel} (${p.oldRole} → ${p.newRole})`
        ).join('\n');
        embed.addFields({ name: '🏆 Son Prestij Geçmişi', value: historyText, inline: false });
      }

      if (userData.records.length > 0) {
        const lastRecords = userData.records.slice(-3).reverse();
        const recordText = lastRecords.map(r =>
          `⚠️ ${r.action}: ${r.reason} (<@${r.operatorId}>)`
        ).join('\n');
        embed.addFields({ name: '📁 Sicil Kayıtları', value: recordText, inline: false });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};

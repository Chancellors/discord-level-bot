const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const { xpForLevel } = require('../../systems/xpEngine');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Kendi seviye kartınızı veya sunucudaki başka birinin kartını görüntüleyin.')
    .addUserOption(opt =>
      opt.setName('kullanici').setDescription('Görüntülenecek kullanıcı').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('gorunum')
        .setDescription('Kart görünüm modu')
        .setRequired(false)
        .addChoices(
          { name: 'Özet', value: 'ozet' },
          { name: 'Detay', value: 'detay' },
          { name: 'İstatistik', value: 'istatistik' }
        )
    )
    .addStringOption(opt =>
      opt.setName('hat')
        .setDescription('Belirli bir hat göster')
        .setRequired(false)
        .addChoices(
          { name: 'Yazı Hattı', value: 'text' },
          { name: 'Ses Hattı', value: 'voice' }
        )
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici') || interaction.user;
    const viewMode = interaction.options.getString('gorunum') || 'ozet';
    const hatFilter = interaction.options.getString('hat');

    const userData = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
    if (!userData) {
      return interaction.reply({ content: '📋 Bu personelin kayıtlarında henüz veri bulunmamaktadır.', ephemeral: true });
    }

    const guildData = await Guild.findOne({ guildId: interaction.guild.id });
    const totalUsers = await User.countDocuments({ guildId: interaction.guild.id });

    // Siralama hesapla
    const textRank = await User.countDocuments({
      guildId: interaction.guild.id,
      $or: [
        { levelText: { $gt: userData.levelText } },
        { levelText: userData.levelText, xpText: { $gt: userData.xpText } },
      ],
    }) + 1;

    const voiceRank = await User.countDocuments({
      guildId: interaction.guild.id,
      $or: [
        { levelVoice: { $gt: userData.levelVoice } },
        { levelVoice: userData.levelVoice, xpVoice: { $gt: userData.xpVoice } },
      ],
    }) + 1;

    // Mevcut rol isimlerini bul
    const findRoleName = (roleList, level) => {
      const entry = roleList?.filter(r => r.level <= level).sort((a, b) => b.level - a.level)[0];
      if (!entry) return 'Personel';
      return interaction.guild.roles.cache.get(entry.roleId)?.name || entry.name || 'Bilinmeyen';
    };

    const textRoleName = findRoleName(guildData?.levelRolesText, userData.levelText);
    const voiceRoleName = findRoleName(guildData?.levelRolesVoice, userData.levelVoice);

    const textXpNeeded = xpForLevel(userData.levelText);
    const voiceXpNeeded = xpForLevel(userData.levelVoice);

    const textPercent = Math.min(100, Math.round((userData.xpText / textXpNeeded) * 100));
    const voicePercent = Math.min(100, Math.round((userData.xpVoice / voiceXpNeeded) * 100));

    // Progress bar olustur
    const makeBar = (current, max) => {
      const percent = Math.min(1, current / max);
      const filled = Math.round(percent * 15);
      return '▰'.repeat(filled) + '▱'.repeat(15 - filled) + ` ${Math.round(percent * 100)}%`;
    };

    const embed = new EmbedBuilder()
      .setColor(userData.cardColor ? parseInt(userData.cardColor.replace('#', ''), 16) : config.colors.prestige)
      .setAuthor({
        name: `${targetUser.username} // Personel Dosyası`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: `Evil Mega Corp // Surveillance Division • ${userData.frozen ? '❄️ DONDURULMUŞ' : '✅ AKTİF'}` })
      .setTimestamp();

    // --- OZET MODU ---
    if (viewMode === 'ozet' || viewMode === 'detay') {
      if (!hatFilter || hatFilter === 'text') {
        embed.addFields({
          name: '📝 Yazı Hattı',
          value: [
            `**Rütbe:** ${textRoleName}`,
            `**Seviye:** ${userData.levelText}`,
            `**XP:** ${userData.xpText.toLocaleString()}/${textXpNeeded.toLocaleString()}`,
            makeBar(userData.xpText, textXpNeeded),
            `**Sıralama:** #${textRank}/${totalUsers}`,
          ].join('\n'),
          inline: true,
        });
      }

      if (!hatFilter || hatFilter === 'voice') {
        embed.addFields({
          name: '🎙️ Ses Hattı',
          value: [
            `**Rütbe:** ${voiceRoleName}`,
            `**Seviye:** ${userData.levelVoice}`,
            `**XP:** ${userData.xpVoice.toLocaleString()}/${voiceXpNeeded.toLocaleString()}`,
            makeBar(userData.xpVoice, voiceXpNeeded),
            `**Sıralama:** #${voiceRank}/${totalUsers}`,
          ].join('\n'),
          inline: true,
        });
      }

      // Sonraki seviye bilgisi
      const nextTextXp = textXpNeeded - userData.xpText;
      const nextVoiceXp = voiceXpNeeded - userData.xpVoice;
      embed.addFields({
        name: '📈 Sonraki Seviye',
        value: [
          !hatFilter || hatFilter === 'text' ? `📝 Yazı: **${nextTextXp.toLocaleString()}** XP kaldı` : null,
          !hatFilter || hatFilter === 'voice' ? `🎙️ Ses: **${nextVoiceXp.toLocaleString()}** XP kaldı` : null,
        ].filter(Boolean).join('\n'),
        inline: false,
      });
    }

    // --- DETAY MODU ---
    if (viewMode === 'detay') {
      embed.addFields({
        name: '📊 Aktivite İstatistikleri',
        value: [
          `**Toplam Mesaj:** ${userData.totalMessagesText.toLocaleString()}`,
          `**Toplam Ses Süresi:** ${Math.floor(userData.totalMinutesVoice / 60)}s ${userData.totalMinutesVoice % 60}dk`,
          `**Dondurulma:** ${userData.frozen ? `❄️ Evet (${userData.frozenBy ? `<@${userData.frozenBy}>` : 'Bilinmeyen'})` : '✅ Hayır'}`,
          `**Kart Teması:** ${userData.cardTheme || 'Varsayılan'}`,
          `**Kayıt Tarihi:** ${userData.createdAt ? `<t:${Math.floor(userData.createdAt.getTime() / 1000)}:R>` : 'Bilinmiyor'}`,
        ].join('\n'),
        inline: false,
      });

      // Son prestij gecmisi
      if (userData.prestigeHistory.length > 0) {
        const lastPrestige = userData.prestigeHistory.slice(-5).reverse();
        const historyText = lastPrestige.map(p =>
          `${p.type === 'text' ? '📝' : '🎙️'} Lv.**${p.oldLevel}** (${p.oldRole}) → Lv.**${p.newLevel}** (${p.newRole})`
        ).join('\n');
        embed.addFields({ name: '🏆 Prestij Geçmişi (Son 5)', value: historyText, inline: false });
      }

      // Sicil kayitlari
      if (userData.records.length > 0) {
        const lastRecords = userData.records.slice(-5).reverse();
        const recordText = lastRecords.map(r =>
          `⚠️ **${r.action}**: ${r.reason} — <@${r.operatorId}> (<t:${Math.floor(r.timestamp.getTime() / 1000)}:R>)`
        ).join('\n');
        embed.addFields({ name: '📁 Sicil Kayıtları (Son 5)', value: recordText, inline: false });
      }

      // Vergi gecmisi
      if (userData.taxHistory.length > 0) {
        const totalTax = userData.taxHistory.reduce((sum, t) => sum + t.amount, 0);
        embed.addFields({
          name: '💰 Vergi Özeti',
          value: `Toplam **${userData.taxHistory.length}** kesinti, toplam **-${totalTax}** XP`,
          inline: false,
        });
      }
    }

    // --- ISTATISTIK MODU ---
    if (viewMode === 'istatistik') {
      const totalXp = userData.xpText + userData.xpVoice;
      const avgXpPerMsg = userData.totalMessagesText > 0 ? Math.round(userData.xpText / userData.totalMessagesText) : 0;
      const avgXpPerHour = userData.totalMinutesVoice > 0 ? Math.round((userData.xpVoice / userData.totalMinutesVoice) * 60) : 0;
      const totalTax = userData.taxHistory.reduce((sum, t) => sum + t.amount, 0);
      const totalLevelUps = userData.prestigeHistory.length;

      embed.addFields(
        {
          name: '📊 Genel İstatistikler',
          value: [
            `**Toplam Birleşik XP:** ${totalXp.toLocaleString()}`,
            `**Toplam Seviye Atlama:** ${totalLevelUps}`,
            `**Toplam Mesaj:** ${userData.totalMessagesText.toLocaleString()}`,
            `**Toplam Ses:** ${Math.floor(userData.totalMinutesVoice / 60)}s ${userData.totalMinutesVoice % 60}dk`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📈 Performans',
          value: [
            `**Mesaj Başına Ort. XP:** ${avgXpPerMsg}`,
            `**Saat Başına Ort. XP:** ${avgXpPerHour}`,
            `**Toplam Vergi:** -${totalTax} XP`,
            `**Sicil Kaydı:** ${userData.records.length} adet`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🏅 Sıralama Pozisyonu',
          value: [
            `📝 Yazı: **#${textRank}** / ${totalUsers} (Üst %${Math.round((textRank / totalUsers) * 100)})`,
            `🎙️ Ses: **#${voiceRank}** / ${totalUsers} (Üst %${Math.round((voiceRank / totalUsers) * 100)})`,
          ].join('\n'),
          inline: false,
        }
      );

      // Acilan temalar
      if (userData.unlockedThemes.length > 0) {
        embed.addFields({
          name: '🎨 Açılan Temalar',
          value: userData.unlockedThemes.map(t => `\`${t}\``).join(', '),
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};

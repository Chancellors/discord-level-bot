const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Sunucudaki en yüksek seviyeli üyelerin liderlik tablosunu gösterir.')
    .addStringOption(opt =>
      opt.setName('hat')
        .setDescription('Hat türü')
        .setRequired(false)
        .addChoices(
          { name: 'Yazı', value: 'yazi' },
          { name: 'Ses', value: 'ses' },
          { name: 'Birleşik (Toplam XP)', value: 'birlesik' }
        )
    )
    .addStringOption(opt =>
      opt.setName('donem')
        .setDescription('Zaman dilimi')
        .setRequired(false)
        .addChoices(
          { name: 'Tüm Zamanlar', value: 'tum' },
          { name: 'Haftalık', value: 'haftalik' },
          { name: 'Aylık', value: 'aylik' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('sayfa')
        .setDescription('Sayfa numarası (her sayfa 15 kişi)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const hat = interaction.options.getString('hat') || 'yazi';
    const donem = interaction.options.getString('donem') || 'tum';
    const page = (interaction.options.getInteger('sayfa') || 1) - 1;
    const perPage = 15;

    const query = { guildId: interaction.guild.id };

    // Donem filtresi
    if (donem === 'haftalik') {
      query.updatedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    } else if (donem === 'aylik') {
      query.updatedAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    let sortField, levelField, hatName;

    if (hat === 'ses') {
      sortField = 'xpVoice';
      levelField = 'levelVoice';
      hatName = '🎙️ Ses Hattı';
    } else if (hat === 'birlesik') {
      sortField = null; // ozel siralama
      levelField = null;
      hatName = '📊 Birleşik (Toplam XP)';
    } else {
      sortField = 'xpText';
      levelField = 'levelText';
      hatName = '📝 Yazı Hattı';
    }

    let topUsers;
    const totalCount = await User.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

    if (hat === 'birlesik') {
      // Aggregate ile toplam XP hesapla
      topUsers = await User.aggregate([
        { $match: query },
        { $addFields: { totalXp: { $add: ['$xpText', '$xpVoice'] }, totalLevel: { $add: ['$levelText', '$levelVoice'] } } },
        { $sort: { totalLevel: -1, totalXp: -1 } },
        { $skip: page * perPage },
        { $limit: perPage },
      ]);
    } else {
      topUsers = await User.find(query)
        .sort({ [levelField]: -1, [sortField]: -1 })
        .skip(page * perPage)
        .limit(perPage);
    }

    if (!topUsers.length) {
      return interaction.reply({ content: '📊 Bu dönem için sıralamaya girecek personel bulunmamaktadır.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const startIndex = page * perPage;

    const lines = await Promise.all(topUsers.map(async (u, i) => {
      const globalIndex = startIndex + i;
      const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
      const name = member?.user?.username || `Bilinmeyen`;

      const prefix = globalIndex < 3 ? medals[globalIndex] : `**${globalIndex + 1}.**`;

      if (hat === 'birlesik') {
        return `${prefix} ${name} — Lv.**${u.totalLevel}** | ${u.totalXp?.toLocaleString()} XP`;
      } else {
        const level = hat === 'ses' ? u.levelVoice : u.levelText;
        const xp = hat === 'ses' ? u.xpVoice : u.xpText;
        return `${prefix} ${name} — Lv.**${level}** | ${xp.toLocaleString()} XP`;
      }
    }));

    // Kullanicinin kendi sirasini bul
    const selfUser = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    let selfRankText = '';
    if (selfUser) {
      let selfRank;
      if (hat === 'birlesik') {
        const totalXp = selfUser.xpText + selfUser.xpVoice;
        const totalLevel = selfUser.levelText + selfUser.levelVoice;
        selfRank = await User.countDocuments({
          guildId: interaction.guild.id,
          $expr: { $gt: [{ $add: ['$levelText', '$levelVoice'] }, totalLevel] },
        }) + 1;
        selfRankText = `\n\n👤 **Senin sıran:** #${selfRank} (Toplam Lv.${totalLevel})`;
      } else if (hat === 'ses') {
        selfRank = await User.countDocuments({
          guildId: interaction.guild.id,
          $or: [
            { levelVoice: { $gt: selfUser.levelVoice } },
            { levelVoice: selfUser.levelVoice, xpVoice: { $gt: selfUser.xpVoice } },
          ],
        }) + 1;
        selfRankText = `\n\n👤 **Senin sıran:** #${selfRank} (Lv.${selfUser.levelVoice})`;
      } else {
        selfRank = await User.countDocuments({
          guildId: interaction.guild.id,
          $or: [
            { levelText: { $gt: selfUser.levelText } },
            { levelText: selfUser.levelText, xpText: { $gt: selfUser.xpText } },
          ],
        }) + 1;
        selfRankText = `\n\n👤 **Senin sıran:** #${selfRank} (Lv.${selfUser.levelText})`;
      }
    }

    const donemNames = { tum: 'Tüm Zamanlar', haftalik: 'Haftalık', aylik: 'Aylık' };

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
      .setTitle(`📊 Evil Mega Corp // Liderlik Tablosu – ${hatName}`)
      .setDescription(lines.join('\n') + selfRankText)
      .setFooter({ text: `${donemNames[donem]} | Sayfa ${page + 1}/${totalPages} | Evil Mega Corp // Surveillance Division` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

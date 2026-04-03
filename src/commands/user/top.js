const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Liderlik tablosunu gösterir.')
    .addStringOption(opt =>
      opt.setName('hat')
        .setDescription('Hat türü')
        .setRequired(false)
        .addChoices(
          { name: 'Yazı', value: 'yazi' },
          { name: 'Ses', value: 'ses' }
        )
    )
    .addStringOption(opt =>
      opt.setName('donem')
        .setDescription('Dönem')
        .setRequired(false)
        .addChoices(
          { name: 'Tüm Zamanlar', value: 'tum' },
          { name: 'Haftalık', value: 'haftalik' }
        )
    ),

  async execute(interaction) {
    const hat = interaction.options.getString('hat') || 'yazi';
    const donem = interaction.options.getString('donem') || 'tum';

    const sortField = hat === 'ses' ? 'xpVoice' : 'xpText';
    const levelField = hat === 'ses' ? 'levelVoice' : 'levelText';
    const hatName = hat === 'ses' ? 'Ses Hattı' : 'Yazı Hattı';

    const query = { guildId: interaction.guild.id };

    // Haftalik filtre (son 7 gun icinde guncellenmis)
    if (donem === 'haftalik') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query.updatedAt = { $gte: oneWeekAgo };
    }

    const topUsers = await User.find(query)
      .sort({ [sortField]: -1 })
      .limit(15);

    if (!topUsers.length) {
      return interaction.reply({ content: '📊 Henüz sıralamaya girecek personel bulunmamaktadır.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(topUsers.map(async (u, i) => {
      const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
      const name = member?.user?.username || `Bilinmeyen (${u.userId})`;
      const prefix = i < 3 ? medals[i] : `**${i + 1}.**`;
      return `${prefix} ${name} — Lv.**${u[levelField]}** | ${u[sortField].toLocaleString()} XP`;
    }));

    const embed = new EmbedBuilder()
      .setColor(config.colors.prestige)
      .setTitle(`📊 Evil Mega Corp // Liderlik Tablosu – ${hatName}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${donem === 'haftalik' ? 'Haftalık' : 'Tüm Zamanlar'} | Evil Mega Corp // Surveillance Division` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

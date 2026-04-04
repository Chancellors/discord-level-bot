const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/queries');
const config = require('../../config');
const { levelForXP } = require('../../systems/xpEngine');

const PAGE_SIZE = 10;

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Sunucu siralamalarini goster.')
    .addSubcommand(sub =>
      sub.setName('ses')
        .setDescription('Ses siralamasi')
        .addIntegerOption(opt =>
          opt.setName('sayfa').setDescription('Sayfa numarasi').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub.setName('yazi')
        .setDescription('Yazi siralamasi')
        .addIntegerOption(opt =>
          opt.setName('sayfa').setDescription('Sayfa numarasi').setRequired(false).setMinValue(1)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const page = interaction.options.getInteger('sayfa') || 1;
    const offset = (page - 1) * PAGE_SIZE;

    const field = sub === 'yazi' ? 'xp_yazi' : 'xp_ses';
    const title = sub === 'yazi' ? 'Yazi Siralamasi' : 'Ses Siralamasi';

    const rows = await db.getLeaderboard(interaction.guild.id, field, PAGE_SIZE, offset);

    if (!rows.length) {
      return interaction.reply({ content: 'Bu sayfada veri bulunamadi.', ephemeral: true });
    }

    const lines = rows.map((row) => {
      const xp = row[field] || 0;
      const level = levelForXP(xp);
      const medal = row.rank <= 3 ? ['', '**[1.]**', '**[2.]**', '**[3.]**'][row.rank] : `**[${row.rank}.]**`;
      return `${medal} <@${row.user_id}> — Seviye **${level}** | ${xp.toLocaleString('tr-TR')} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.colors.operational)
      .setTitle(`Evil Mega Corp // ${title}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Sayfa ${page} | Her sayfada ${PAGE_SIZE} personel listelenir` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

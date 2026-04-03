const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission, isDev } = require('../../utils/permissions');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Erişebildiğiniz komutların dinamik rehberini gösterir.'),

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const member = interaction.member;
    const guildId = interaction.guild.id;

    const categories = {
      user: { title: '👤 Personel Komutları', commands: [] },
      admin: { title: '⚙️ Yönetici Komutları', commands: [] },
      dev: { title: '👑 Geliştirici Komutları', commands: [] },
    };

    for (const [name, cmd] of client.commands) {
      const cat = cmd.category || 'user';

      if (cat === 'dev' && !isDev(userId)) continue;

      if (cat === 'admin') {
        const allowed = await hasPermission(userId, member, guildId, name);
        if (!allowed) continue;
      }

      categories[cat]?.commands.push(`\`/${name}\` — ${cmd.data.description}`);
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📖 Evil Mega Corp // Komut Rehberi')
      .setDescription('Aşağıda yetki seviyenize göre erişebildiğiniz komutlar listelenmiştir.')
      .setFooter({ text: 'Evil Mega Corp // Surveillance Division' })
      .setTimestamp();

    for (const [, cat] of Object.entries(categories)) {
      if (cat.commands.length > 0) {
        embed.addFields({ name: cat.title, value: cat.commands.join('\n'), inline: false });
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

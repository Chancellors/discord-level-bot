const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission, isDev } = require('../../utils/permissions');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Erişebildiğiniz komutların dinamik rehberini gösterir.')
    .addStringOption(opt =>
      opt.setName('kategori')
        .setDescription('Belirli bir kategori göster')
        .setRequired(false)
        .addChoices(
          { name: 'Personel Komutları', value: 'user' },
          { name: 'Yönetici Komutları', value: 'admin' },
          { name: 'Geliştirici Komutları', value: 'dev' }
        )
    ),

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const member = interaction.member;
    const guildId = interaction.guild.id;
    const filterCat = interaction.options.getString('kategori');

    const categories = {
      user: {
        title: '👤 Personel Komutları',
        description: 'Tüm personelin erişebildiği temel komutlar.',
        commands: [],
      },
      admin: {
        title: '⚙️ Yönetici Komutları',
        description: 'Sadece yetkilendirilmiş rollerin erişebildiği yönetim araçları.',
        commands: [],
      },
      dev: {
        title: '👑 Geliştirici Komutları (Shadow Authority)',
        description: 'Mutlak otorite — sadece geliştirici ID\'leri erişebilir.',
        commands: [],
      },
    };

    for (const [name, cmd] of client.commands) {
      const cat = cmd.category || 'user';

      if (cat === 'dev' && !isDev(userId)) continue;

      if (cat === 'admin') {
        const allowed = await hasPermission(userId, member, guildId, name);
        if (!allowed) continue;
      }

      // Subcommandlari topla
      const subcommands = cmd.data.options
        ?.filter(o => o.toJSON().type === 1) // SUB_COMMAND
        ?.map(o => `\`${o.toJSON().name}\``) || [];

      const subText = subcommands.length > 0 ? ` [${subcommands.join(' / ')}]` : '';
      categories[cat]?.commands.push(`\`/${name}\`${subText}\n  ↳ ${cmd.data.description}`);
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📖 Evil Mega Corp // Komut Rehberi')
      .setDescription('Yetki seviyenize göre erişebildiğiniz komutlar aşağıda listelenmiştir.\nKullanım: `/komut-adı alt-komut`')
      .setFooter({ text: `${client.commands.size} komut kayıtlı | Evil Mega Corp // Surveillance Division` })
      .setTimestamp();

    for (const [key, cat] of Object.entries(categories)) {
      if (filterCat && key !== filterCat) continue;
      if (cat.commands.length > 0) {
        embed.addFields({
          name: `${cat.title} (${cat.commands.length})`,
          value: cat.commands.join('\n\n').substring(0, 1024),
          inline: false,
        });
      }
    }

    // Erisim ozeti
    const accessibleCount = Object.values(categories).reduce((sum, c) => sum + c.commands.length, 0);
    embed.addFields({
      name: '🔐 Erişim Özeti',
      value: [
        `**Erişebildiğiniz:** ${accessibleCount}/${client.commands.size} komut`,
        isDev(userId) ? '👑 **Yetki Seviyesi:** Geliştirici (Mutlak Otorite)' : '',
      ].filter(Boolean).join('\n'),
      inline: false,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');

const THEMES = ['default', 'dark', 'neon', 'corporate'];
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('kart-ayar')
    .setDescription('Seviye karti gorunum ayarlari.')
    .addSubcommand(sub =>
      sub.setName('tema')
        .setDescription('Kart temasini degistir.')
        .addStringOption(opt =>
          opt.setName('tema')
            .setDescription('Tema secimi')
            .setRequired(true)
            .addChoices(
              { name: 'Varsayilan', value: 'default' },
              { name: 'Karanlik', value: 'dark' },
              { name: 'Neon', value: 'neon' },
              { name: 'Kurumsal', value: 'corporate' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('renk')
        .setDescription('Kart vurgu rengini degistir.')
        .addStringOption(opt =>
          opt.setName('renk')
            .setDescription('HEX renk kodu (ornek: #ff0000)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('goster')
        .setDescription('Mevcut kart ayarlarini goster.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const userData = await cache.getUser(userId, guildId);
    if (!userData) {
      return interaction.reply({ content: 'Kullanici verisi bulunamadi.', ephemeral: true });
    }

    if (sub === 'tema') {
      const tema = interaction.options.getString('tema');
      userData.card_theme = tema;
      cache.setUser(userId, guildId, userData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('Kart Temasi Guncellendi')
        .setDescription(`Yeni tema: **${tema}**`)
        .setFooter({ text: 'Evil Mega Corp // Kisiselletirme' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'renk') {
      const renk = interaction.options.getString('renk');

      if (!HEX_REGEX.test(renk)) {
        return interaction.reply({
          content: 'Gecersiz renk kodu. Ornek format: `#ff0000`',
          ephemeral: true,
        });
      }

      userData.card_color = renk;
      cache.setUser(userId, guildId, userData);

      const embed = new EmbedBuilder()
        .setColor(renk)
        .setTitle('Kart Rengi Guncellendi')
        .setDescription(`Yeni vurgu rengi: **${renk}**`)
        .setFooter({ text: 'Evil Mega Corp // Kisiselletirme' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'goster') {
      const theme = userData.card_theme || 'default';
      const color = userData.card_color || 'Ayarlanmamis';

      const embed = new EmbedBuilder()
        .setColor(userData.card_color || config.colors.info)
        .setTitle('Mevcut Kart Ayarlari')
        .addFields(
          { name: 'Tema', value: theme, inline: true },
          { name: 'Vurgu Rengi', value: color, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Kisiselletirme' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const config = require('../../config');

// Seviyeye gore acilan temalar
const THEMES = {
  default: { name: 'Varsayılan', unlockLevel: 0 },
  dark: { name: 'Karanlık', unlockLevel: 5 },
  neon: { name: 'Neon', unlockLevel: 10 },
  gold: { name: 'Altın', unlockLevel: 20 },
  shadow: { name: 'Gölge', unlockLevel: 30 },
  crimson: { name: 'Kızıl', unlockLevel: 50 },
};

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('kart-ayar')
    .setDescription('Seviye kartınızın temasını ve rengini ayarlayın.')
    .addStringOption(opt =>
      opt.setName('tema')
        .setDescription('Kart teması')
        .setRequired(false)
        .addChoices(...Object.entries(THEMES).map(([k, v]) => ({ name: `${v.name} (Lv.${v.unlockLevel})`, value: k })))
    )
    .addStringOption(opt =>
      opt.setName('renk')
        .setDescription('HEX renk kodu (ör: #ff5500)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const tema = interaction.options.getString('tema');
    const renk = interaction.options.getString('renk');

    const userData = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    if (!userData) {
      return interaction.reply({ content: '📋 Henüz bir personel kaydınız bulunmuyor. Önce biraz aktif olun!', ephemeral: true });
    }

    const maxLevel = Math.max(userData.levelText, userData.levelVoice);
    const updates = {};

    if (tema) {
      const themeData = THEMES[tema];
      if (!themeData) {
        return interaction.reply({ content: '❌ Geçersiz tema.', ephemeral: true });
      }
      if (maxLevel < themeData.unlockLevel) {
        return interaction.reply({
          content: `🔒 **${themeData.name}** teması için en az **Lv.${themeData.unlockLevel}** olmalısınız. Şu anki en yüksek seviyeniz: **Lv.${maxLevel}**`,
          ephemeral: true,
        });
      }
      updates.cardTheme = tema;
      if (!userData.unlockedThemes.includes(tema)) {
        updates.$addToSet = { unlockedThemes: tema };
      }
    }

    if (renk) {
      if (!/^#[0-9a-fA-F]{6}$/.test(renk)) {
        return interaction.reply({ content: '❌ Geçersiz renk kodu. Örnek: `#ff5500`', ephemeral: true });
      }
      updates.cardColor = renk;
    }

    if (!tema && !renk) {
      // Mevcut ayarlari goster
      const unlockedList = Object.entries(THEMES)
        .map(([k, v]) => {
          const unlocked = maxLevel >= v.unlockLevel;
          const active = userData.cardTheme === k;
          return `${unlocked ? '🔓' : '🔒'} ${v.name} (Lv.${v.unlockLevel})${active ? ' ✅' : ''}`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🎨 Kart Ayarları')
        .setDescription(`**Aktif Tema:** ${THEMES[userData.cardTheme]?.name || 'Varsayılan'}\n**Renk:** ${userData.cardColor}\n\n**Temalar:**\n${unlockedList}`)
        .setFooter({ text: 'Evil Mega Corp // Customization' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (updates.$addToSet) {
      const { $addToSet, ...rest } = updates;
      await User.updateOne(
        { userId: interaction.user.id, guildId: interaction.guild.id },
        { $set: rest, $addToSet }
      );
    } else {
      await User.updateOne(
        { userId: interaction.user.id, guildId: interaction.guild.id },
        { $set: updates }
      );
    }

    await interaction.reply({
      content: `✅ Kart ayarlarınız güncellendi.${tema ? ` Tema: **${THEMES[tema].name}**` : ''}${renk ? ` Renk: **${renk}**` : ''}`,
      ephemeral: true,
    });
  },
};

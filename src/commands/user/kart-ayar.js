const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const config = require('../../config');

// Seviyeye gore acilan temalar
const THEMES = {
  default: { name: 'Varsayılan', unlockLevel: 0, color: '#ffffff', description: 'Standart kurumsal tema' },
  dark: { name: 'Karanlık', unlockLevel: 5, color: '#1a1a2e', description: 'Koyu tonlarda minimal tasarım' },
  midnight: { name: 'Gece Yarısı', unlockLevel: 8, color: '#0a0a23', description: 'Derin gece mavisi' },
  neon: { name: 'Neon', unlockLevel: 10, color: '#39ff14', description: 'Parlak neon yeşil aksan' },
  ocean: { name: 'Okyanus', unlockLevel: 15, color: '#006994', description: 'Derin okyanus tonları' },
  gold: { name: 'Altın', unlockLevel: 20, color: '#ffd700', description: 'Lüks altın prestij' },
  ruby: { name: 'Yakut', unlockLevel: 25, color: '#e0115f', description: 'Kırmızı yakut parıltısı' },
  shadow: { name: 'Gölge', unlockLevel: 30, color: '#2d1b69', description: 'Gizemli karanlık mor' },
  emerald: { name: 'Zümrüt', unlockLevel: 40, color: '#50c878', description: 'Değerli zümrüt yeşili' },
  crimson: { name: 'Kızıl', unlockLevel: 50, color: '#dc143c', description: 'Elit kızıl prestij' },
  phantom: { name: 'Hayalet', unlockLevel: 75, color: '#708090', description: 'Gölge otorite teması' },
  overlord: { name: 'Overlord', unlockLevel: 100, color: '#000000', description: 'Mutlak otorite — en nadir tema' },
};

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('kart-ayar')
    .setDescription('Seviye kartınızın temasını ve renklerini özelleştirin.')
    .addSubcommand(sub =>
      sub.setName('tema')
        .setDescription('Kart temasını değiştir.')
        .addStringOption(opt =>
          opt.setName('secim')
            .setDescription('Tema seçimi')
            .setRequired(true)
            .addChoices(...Object.entries(THEMES).map(([k, v]) => ({
              name: `${v.name} (Lv.${v.unlockLevel})`,
              value: k,
            })))
        )
    )
    .addSubcommand(sub =>
      sub.setName('renk')
        .setDescription('Özel HEX renk kodu ayarla.')
        .addStringOption(opt =>
          opt.setName('kod').setDescription('HEX renk kodu (ör: #ff5500)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('goruntule')
        .setDescription('Mevcut kart ayarlarını ve açılabilir temaları göster.')
    )
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Kart ayarlarını varsayılana döndür.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    const userData = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
    if (!userData) {
      return interaction.reply({ content: '📋 Henüz bir personel kaydınız bulunmuyor. Önce biraz aktif olun!', ephemeral: true });
    }

    const maxLevel = Math.max(userData.levelText, userData.levelVoice);

    if (sub === 'tema') {
      const secim = interaction.options.getString('secim');
      const themeData = THEMES[secim];

      if (!themeData) {
        return interaction.reply({ content: '❌ Geçersiz tema.', ephemeral: true });
      }
      if (maxLevel < themeData.unlockLevel) {
        return interaction.reply({
          content: `🔒 **${themeData.name}** teması için en az **Lv.${themeData.unlockLevel}** olmalısınız.\nŞu anki en yüksek seviyeniz: **Lv.${maxLevel}**`,
          ephemeral: true,
        });
      }

      await User.updateOne(
        { userId: interaction.user.id, guildId: interaction.guild.id },
        { $set: { cardTheme: secim }, $addToSet: { unlockedThemes: secim } }
      );

      const embed = new EmbedBuilder()
        .setColor(parseInt(themeData.color.replace('#', ''), 16))
        .setTitle(`🎨 Tema Değiştirildi: ${themeData.name}`)
        .setDescription(themeData.description)
        .addFields({ name: 'Renk Tonu', value: themeData.color, inline: true })
        .setFooter({ text: 'Evil Mega Corp // Customization' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'renk') {
      const kod = interaction.options.getString('kod');
      if (!/^#[0-9a-fA-F]{6}$/.test(kod)) {
        return interaction.reply({ content: '❌ Geçersiz renk kodu. Örnek: `#ff5500`', ephemeral: true });
      }

      await User.updateOne(
        { userId: interaction.user.id, guildId: interaction.guild.id },
        { $set: { cardColor: kod } }
      );

      const embed = new EmbedBuilder()
        .setColor(parseInt(kod.replace('#', ''), 16))
        .setTitle('🎨 Renk Güncellendi')
        .setDescription(`Yeni renk: **${kod}**`)
        .setFooter({ text: 'Evil Mega Corp // Customization' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'goruntule') {
      const unlockedCount = Object.entries(THEMES).filter(([, v]) => maxLevel >= v.unlockLevel).length;
      const totalThemes = Object.keys(THEMES).length;

      const themeList = Object.entries(THEMES).map(([k, v]) => {
        const unlocked = maxLevel >= v.unlockLevel;
        const active = userData.cardTheme === k;
        const status = active ? '✅ AKTİF' : (unlocked ? '🔓' : '🔒');
        return `${status} **${v.name}** (Lv.${v.unlockLevel}) — ${v.description}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🎨 Evil Mega Corp // Kart Ayarları')
        .addFields(
          {
            name: '📋 Mevcut Ayarlar',
            value: [
              `**Aktif Tema:** ${THEMES[userData.cardTheme]?.name || 'Varsayılan'}`,
              `**Renk:** ${userData.cardColor || '#ffffff'}`,
              `**En Yüksek Seviye:** Lv.${maxLevel}`,
              `**Açılan Tema:** ${unlockedCount}/${totalThemes}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🗂️ Tema Kataloğu',
            value: themeList,
            inline: false,
          }
        )
        .setFooter({ text: 'Evil Mega Corp // Customization' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'sifirla') {
      await User.updateOne(
        { userId: interaction.user.id, guildId: interaction.guild.id },
        { $set: { cardTheme: 'default', cardColor: '#ffffff' } }
      );

      return interaction.reply({ content: '✅ Kart ayarlarınız varsayılana döndürüldü.', ephemeral: true });
    }
  },
};

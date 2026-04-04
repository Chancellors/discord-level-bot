const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Mevcut komutlari ve XP sistemini goster.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('Evil Mega Corp // Komut Rehberi')
      .setDescription('Asagida tum kullanilabilir komutlar ve XP sistemi bilgileri yer almaktadir.')
      .addFields(
        {
          name: 'Kullanici Komutlari',
          value: [
            '`/rank` — Seviye kartini goster',
            '`/top ses|yazi` — Sunucu siralamasini goster',
            '`/yardim` — Bu yardim mesajini goster',
            '`/kart-ayar` — Kart tema ve renk ayarlari',
            '`/hakkinda` — Bot hakkinda bilgi',
            '`/bildirim` — DM bildirim tercihleri',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Yonetici Komutlari',
          value: [
            '`/setup` — Kurulum sihirbazi',
            '`/rol-tanimla` — Seviye rollerini tanimla',
            '`/ayar` — Sunucu ayarlari',
            '`/karsilayici` — Hosgeldin/ayrilma mesajlari',
            '`/kara-liste` — Kanal/rol kara listesi',
            '`/askiya-al` — Kullaniciyi askiya al',
            '`/xp` — XP ekle/cikar/sifirla',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Gelistirici Komutlari',
          value: [
            '`/eval` — Kod calistir',
            '`/bakim` — Bakim modunu ac/kapat',
            '`/cache` — Onbellek islemleri',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'XP Sistemi',
          value: [
            `Ses: **${config.xp.voicePerMinute} XP/dakika**`,
            `Yazi: **${config.xp.textPerWord} XP/kelime**`,
            `Seviye: **${config.xp.perLevel} XP = 1 Seviye**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: 'Carpanlar',
          value: [
            `Gece (00:00-08:00): **x${config.nightMultiplier}**`,
            `Kamera/Yayin: **x${config.streamMultiplier}**`,
            `Pasif (AFK/Sagir): **x${config.passiveMultiplier}**`,
          ].join('\n'),
          inline: true,
        }
      )
      .setFooter({ text: 'Evil Mega Corp // Personel Kilavuzu' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

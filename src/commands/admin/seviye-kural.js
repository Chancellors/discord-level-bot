const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('seviye-kural')
    .setDescription('Seviye bazlı ses izinlerini ve XP koşullarını yönetin.')
    .addSubcommand(sub =>
      sub.setName('ayarla')
        .setDescription('Ses koşullarını ayarlayın.')
        .addStringOption(opt =>
          opt.setName('kosul')
            .setDescription('Koşul türü')
            .setRequired(true)
            .addChoices(
              { name: 'Mute İzin Seviyesi', value: 'muteAllowedLevel' },
              { name: 'Deafen İzin Seviyesi', value: 'deafenAllowedLevel' },
              { name: 'Solo XP Seviyesi', value: 'soloXpLevel' },
              { name: 'Min. Kişi Sayısı', value: 'minUsersForXp' }
            )
        )
        .addIntegerOption(opt => opt.setName('deger').setDescription('Değer (seviye veya kişi sayısı)').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('afk-xp')
        .setDescription('AFK kanalında XP kazanımını açar veya kapatır.')
        .addBooleanOption(opt => opt.setName('aktif').setDescription('AFK kanalında XP kazanılsın mı?').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('listele')
        .setDescription('Mevcut tüm ses koşullarını detaylı listele.')
    )
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Tüm ses koşullarını fabrika ayarlarına sıfırla.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

    if (sub === 'ayarla') {
      const kosul = interaction.options.getString('kosul');
      const deger = interaction.options.getInteger('deger');

      if (kosul === 'minUsersForXp') {
        guildData.voiceConditions.minUsersForXp = deger;
      } else {
        guildData.voiceConditions[kosul] = deger;
      }
      await guildData.save();

      const kosulNames = {
        muteAllowedLevel: 'Mute İzin Seviyesi',
        deafenAllowedLevel: 'Deafen İzin Seviyesi',
        soloXpLevel: 'Solo XP Seviyesi',
        minUsersForXp: 'Min. Kişi Sayısı',
      };

      const kosulDescriptions = {
        muteAllowedLevel: `Lv.${deger} altındaki üyeler mikrofon kapatınca XP kazanamaz`,
        deafenAllowedLevel: `Lv.${deger} altındaki üyeler kulaklık kapatınca XP kazanamaz`,
        soloXpLevel: `Lv.${deger} altındaki üyeler odada tek başınayken XP kazanamaz`,
        minUsersForXp: `XP kazanmak için odada en az ${deger} kişi olmalı`,
      };

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Koşul', value: kosulNames[kosul], inline: true },
          { name: 'Yeni Değer', value: `${deger}`, inline: true },
        ],
      });

      return interaction.reply({
        content: `✅ **${kosulNames[kosul]}** → **${deger}** olarak ayarlandı.\n📋 ${kosulDescriptions[kosul]}`,
        ephemeral: true,
      });
    }

    if (sub === 'afk-xp') {
      const aktif = interaction.options.getBoolean('aktif');
      guildData.voiceConditions.afkXpAllowed = aktif;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi: AFK XP',
        operatorId: interaction.user.id,
        fields: [{ name: 'Durum', value: aktif ? '✅ Açık' : '❌ Kapalı', inline: true }],
      });

      return interaction.reply({
        content: aktif
          ? '✅ AFK kanalında XP kazanımı **açıldı**. Üyeler AFK odasında da XP kazanabilir.'
          : '✅ AFK kanalında XP kazanımı **kapatıldı**. AFK odasında XP kazanılamayacak.',
        ephemeral: true,
      });
    }

    if (sub === 'listele') {
      const vc = guildData.voiceConditions;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🎙️ Evil Mega Corp // Ses Koşulları Detayı')
        .addFields(
          {
            name: '🔇 Mikrofon (Mute) Kuralı',
            value: [
              `**İzin Seviyesi:** Lv.${vc.muteAllowedLevel || 0}`,
              vc.muteAllowedLevel > 0
                ? `⚠️ Lv.${vc.muteAllowedLevel} altındaki üyeler mikrofon kapatınca XP kazanamaz`
                : '✅ Tüm seviyeler mikrofon kapalıyken XP kazanabilir',
            ].join('\n'),
            inline: false,
          },
          {
            name: '🔕 Kulaklık (Deafen) Kuralı',
            value: [
              `**İzin Seviyesi:** Lv.${vc.deafenAllowedLevel || 0}`,
              vc.deafenAllowedLevel > 0
                ? `⚠️ Lv.${vc.deafenAllowedLevel} altındaki üyeler kulaklık kapatınca XP kazanamaz`
                : '✅ Tüm seviyeler kulaklık kapalıyken XP kazanabilir',
            ].join('\n'),
            inline: false,
          },
          {
            name: '👤 Solo (Tek Kişi) Kuralı',
            value: [
              `**İzin Seviyesi:** Lv.${vc.soloXpLevel || 0}`,
              `**Min. Kişi Sayısı:** ${vc.minUsersForXp || 2}`,
              vc.soloXpLevel > 0
                ? `⚠️ Lv.${vc.soloXpLevel} altındaki üyeler odada tek başınayken XP kazanamaz`
                : `✅ Odada ${vc.minUsersForXp || 2}+ kişi olduğunda herkes XP kazanır`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '💤 AFK Kuralı',
            value: [
              `**AFK XP:** ${vc.afkXpAllowed ? '✅ Açık' : '❌ Kapalı'}`,
              vc.afkXpAllowed
                ? '⚠️ Üyeler AFK odasında da XP kazanabiliyor'
                : '✅ AFK odasında XP kazanımı engelleniyor',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'sifirla') {
      guildData.voiceConditions = {
        muteAllowedLevel: 0,
        deafenAllowedLevel: 0,
        soloXpLevel: 0,
        afkXpAllowed: false,
        minUsersForXp: 2,
      };
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ses Koşulları Sıfırlandı',
        description: 'Tüm ses koşulları fabrika ayarlarına döndürüldü.',
        operatorId: interaction.user.id,
      });

      return interaction.reply({ content: '✅ Tüm ses koşulları fabrika ayarlarına sıfırlandı.', ephemeral: true });
    }
  },
};

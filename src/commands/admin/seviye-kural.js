const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('seviye-kural')
    .setDescription('Seviye bazlı ses izinlerini yönetin.')
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
              { name: 'Solo XP Seviyesi', value: 'soloXpLevel' }
            )
        )
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Minimum seviye').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('listele')
        .setDescription('Mevcut ses koşullarını listele.')
    )
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Tüm ses koşullarını sıfırla.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

    if (sub === 'ayarla') {
      const kosul = interaction.options.getString('kosul');
      const seviye = interaction.options.getInteger('seviye');

      guildData.voiceConditions[kosul] = seviye;
      await guildData.save();

      const kosulNames = {
        muteAllowedLevel: 'Mute İzin Seviyesi',
        deafenAllowedLevel: 'Deafen İzin Seviyesi',
        soloXpLevel: 'Solo XP Seviyesi',
      };

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Koşul', value: kosulNames[kosul], inline: true },
          { name: 'Yeni Değer', value: `Lv.${seviye}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ **${kosulNames[kosul]}** → Lv.**${seviye}** olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'listele') {
      const vc = guildData.voiceConditions;
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🎙️ Ses Koşulları')
        .addFields(
          { name: 'Mute İzin Seviyesi', value: `Lv.${vc.muteAllowedLevel}`, inline: true },
          { name: 'Deafen İzin Seviyesi', value: `Lv.${vc.deafenAllowedLevel}`, inline: true },
          { name: 'Solo XP Seviyesi', value: `Lv.${vc.soloXpLevel}`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'sifirla') {
      guildData.voiceConditions = { muteAllowedLevel: 0, deafenAllowedLevel: 0, soloXpLevel: 0 };
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ses Koşulları Sıfırlandı',
        operatorId: interaction.user.id,
      });

      return interaction.reply({ content: '✅ Tüm ses koşulları sıfırlandı.', ephemeral: true });
    }
  },
};

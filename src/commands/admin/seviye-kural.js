const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const { log, LogTier } = require('../../utils/logger');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('seviye-kural')
    .setDescription('Seviye ve XP kurallarını yapılandır.')
    .addSubcommand(sub =>
      sub.setName('ses-sessiz')
        .setDescription('Ses kanalında sessiz kullanıcıların XP alabilmesi için minimum seviye.')
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Minimum seviye').setRequired(true).setMinValue(0)))
    .addSubcommand(sub =>
      sub.setName('ses-sagir')
        .setDescription('Ses kanalında sağır kullanıcıların XP alabilmesi için minimum seviye.')
        .addIntegerOption(opt => opt.setName('seviye').setDescription('Minimum seviye').setRequired(true).setMinValue(0)))
    .addSubcommand(sub =>
      sub.setName('ses-hop-limit')
        .setDescription('Ses kanalı hop spam limiti.')
        .addIntegerOption(opt => opt.setName('sayi').setDescription('Maksimum hop sayısı').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('spam-mesaj-limit')
        .setDescription('Anti-spam maksimum mesaj limiti.')
        .addIntegerOption(opt => opt.setName('sayi').setDescription('Maksimum mesaj sayısı').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('goster')
        .setDescription('Mevcut seviye kurallarını göster.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildData = await cache.getGuild(guildId);

    if (sub === 'ses-sessiz') {
      const seviye = interaction.options.getInteger('seviye');
      guildData.voice_mute_allowed_level = seviye;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: `✅ Sessiz kullanıcı XP seviyesi **${seviye}** olarak ayarlandı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi',
        description: `Ses sessiz minimum seviye: ${seviye}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'ses-sagir') {
      const seviye = interaction.options.getInteger('seviye');
      guildData.voice_deafen_allowed_level = seviye;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: `✅ Sağır kullanıcı XP seviyesi **${seviye}** olarak ayarlandı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi',
        description: `Ses sağır minimum seviye: ${seviye}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'ses-hop-limit') {
      const sayi = interaction.options.getInteger('sayi');
      guildData.anti_spam_voice_hop_limit = sayi;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: `✅ Ses hop limiti **${sayi}** olarak ayarlandı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi',
        description: `Ses hop limiti: ${sayi}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'spam-mesaj-limit') {
      const sayi = interaction.options.getInteger('sayi');
      guildData.anti_spam_max_messages = sayi;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: `✅ Spam mesaj limiti **${sayi}** olarak ayarlandı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Seviye Kuralı Güncellendi',
        description: `Spam mesaj limiti: ${sayi}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'goster') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📏 Evil Mega Corp // Seviye Kuralları')
        .addFields(
          { name: '🔇 Sessiz XP Seviyesi', value: `${guildData.voice_mute_allowed_level ?? 0}`, inline: true },
          { name: '🔈 Sağır XP Seviyesi', value: `${guildData.voice_deafen_allowed_level ?? 0}`, inline: true },
          { name: '🔀 Ses Hop Limiti', value: `${guildData.anti_spam_voice_hop_limit ?? 'Ayarlanmadı'}`, inline: true },
          { name: '📨 Spam Mesaj Limiti', value: `${guildData.anti_spam_max_messages ?? 'Ayarlanmadı'}`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Kurallar' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

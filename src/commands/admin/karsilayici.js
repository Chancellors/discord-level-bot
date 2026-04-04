const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const { log, LogTier } = require('../../utils/logger');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('karsilayici')
    .setDescription('Hoş geldin ve ayrılma mesajlarını yönet.')
    .addSubcommand(sub =>
      sub.setName('hosgeldin-ayarla')
        .setDescription('Hoş geldin mesajını ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Mesajın gönderileceği kanal').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption(opt => opt.setName('mesaj').setDescription('Mesaj şablonu ([user], [userName], [memberCount], [server])').setRequired(true))
        .addBooleanOption(opt => opt.setName('dm').setDescription('DM olarak da gönderilsin mi?').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('hosgeldin-ac')
        .setDescription('Hoş geldin mesajını aktifleştir.'))
    .addSubcommand(sub =>
      sub.setName('hosgeldin-kapat')
        .setDescription('Hoş geldin mesajını devre dışı bırak.'))
    .addSubcommand(sub =>
      sub.setName('ayrilma-ayarla')
        .setDescription('Ayrılma mesajını ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Mesajın gönderileceği kanal').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption(opt => opt.setName('mesaj').setDescription('Mesaj şablonu ([user], [userName], [memberCount], [server])').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ayrilma-ac')
        .setDescription('Ayrılma mesajını aktifleştir.'))
    .addSubcommand(sub =>
      sub.setName('ayrilma-kapat')
        .setDescription('Ayrılma mesajını devre dışı bırak.'))
    .addSubcommand(sub =>
      sub.setName('onizle')
        .setDescription('Mevcut hoş geldin ve ayrılma mesajlarını önizle.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildData = await cache.getGuild(guildId);

    if (sub === 'hosgeldin-ayarla') {
      const kanal = interaction.options.getChannel('kanal');
      const mesaj = interaction.options.getString('mesaj');
      const dm = interaction.options.getBoolean('dm') ?? false;

      guildData.welcome_channel = kanal.id;
      guildData.welcome_message = mesaj;
      guildData.welcome_send_dm = dm;
      cache.setGuild(guildId, guildData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle('✅ Hoş Geldin Mesajı Ayarlandı')
        .addFields(
          { name: '📢 Kanal', value: `${kanal}`, inline: true },
          { name: '📨 DM', value: dm ? 'Evet' : 'Hayır', inline: true },
          { name: '💬 Mesaj', value: `\`${mesaj}\``, inline: false },
        )
        .setFooter({ text: 'Evil Mega Corp // Karşılayıcı' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Hoş Geldin Mesajı Ayarlandı',
        description: `Kanal: ${kanal.name}, DM: ${dm}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'hosgeldin-ac') {
      guildData.welcome_enabled = true;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: '✅ Hoş geldin mesajı **aktifleştirildi**.', ephemeral: true });
      return;
    }

    if (sub === 'hosgeldin-kapat') {
      guildData.welcome_enabled = false;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: '✅ Hoş geldin mesajı **devre dışı bırakıldı**.', ephemeral: true });
      return;
    }

    if (sub === 'ayrilma-ayarla') {
      const kanal = interaction.options.getChannel('kanal');
      const mesaj = interaction.options.getString('mesaj');

      guildData.leave_channel = kanal.id;
      guildData.leave_message = mesaj;
      cache.setGuild(guildId, guildData);

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle('✅ Ayrılma Mesajı Ayarlandı')
        .addFields(
          { name: '📢 Kanal', value: `${kanal}`, inline: true },
          { name: '💬 Mesaj', value: `\`${mesaj}\``, inline: false },
        )
        .setFooter({ text: 'Evil Mega Corp // Karşılayıcı' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayrılma Mesajı Ayarlandı',
        description: `Kanal: ${kanal.name}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'ayrilma-ac') {
      guildData.leave_enabled = true;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: '✅ Ayrılma mesajı **aktifleştirildi**.', ephemeral: true });
      return;
    }

    if (sub === 'ayrilma-kapat') {
      guildData.leave_enabled = false;
      cache.setGuild(guildId, guildData);
      await interaction.reply({ content: '✅ Ayrılma mesajı **devre dışı bırakıldı**.', ephemeral: true });
      return;
    }

    if (sub === 'onizle') {
      const formatPreview = (template, guild, user) => {
        if (!template) return '*Ayarlanmamış*';
        return template
          .replace(/\[user\]/g, `${user}`)
          .replace(/\[userName\]/g, user.username)
          .replace(/\[memberCount\]/g, `${guild.memberCount}`)
          .replace(/\[server\]/g, guild.name);
      };

      const welcomePreview = formatPreview(guildData.welcome_message, interaction.guild, interaction.user);
      const leavePreview = formatPreview(guildData.leave_message, interaction.guild, interaction.user);

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('👁️ Evil Mega Corp // Mesaj Önizleme')
        .addFields(
          { name: '👋 Hoş Geldin', value: `**Durum:** ${guildData.welcome_enabled ? 'Aktif' : 'Devre dışı'}\n**Kanal:** ${guildData.welcome_channel ? `<#${guildData.welcome_channel}>` : 'Ayarlanmadı'}\n**DM:** ${guildData.welcome_send_dm ? 'Evet' : 'Hayır'}\n**Önizleme:**\n${welcomePreview}`, inline: false },
          { name: '🚪 Ayrılma', value: `**Durum:** ${guildData.leave_enabled ? 'Aktif' : 'Devre dışı'}\n**Kanal:** ${guildData.leave_channel ? `<#${guildData.leave_channel}>` : 'Ayarlanmadı'}\n**Önizleme:**\n${leavePreview}`, inline: false },
        )
        .setFooter({ text: 'Evil Mega Corp // Karşılayıcı Önizleme' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

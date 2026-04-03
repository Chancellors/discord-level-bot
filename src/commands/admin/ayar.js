const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('ayar')
    .setDescription('Sistem konfigürasyonunu yönetin ve görüntüleyin.')
    .addSubcommand(sub =>
      sub.setName('goruntule')
        .setDescription('Tüm mevcut sistem ayarlarını görüntüle.')
    )
    .addSubcommand(sub =>
      sub.setName('log-kanal')
        .setDescription('Denetim günlüklerinin gönderileceği kanalı seçer.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Log kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('bildirim-kanal')
        .setDescription('Seviye atlama duyurularının yapılacağı kanalı seçer.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Bildirim kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('bildirim-durum')
        .setDescription('Seviye atlama bildirimlerini sunucu genelinde açar veya kapatır.')
        .addBooleanOption(opt => opt.setName('aktif').setDescription('Bildirimler aktif mi?').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('bildirim-mesaji')
        .setDescription('Bildirim mesaj şablonunu değiştirir ({user}, {oldLevel}, {newLevel}, {oldRole}, {newRole}).')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addStringOption(opt => opt.setName('sablon').setDescription('Yeni mesaj şablonu').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('xp-etkinlik')
        .setDescription('XP çarpanını ayarlar (etkinlikler için 2x, 3x vb.).')
        .addNumberOption(opt => opt.setName('carpan').setDescription('Çarpan değeri (ör: 1.5, 2.0)').setRequired(true).setMinValue(0.1).setMaxValue(10))
    )
    .addSubcommand(sub =>
      sub.setName('baslangic-rol')
        .setDescription('Sunucuya yeni katılanlara otomatik verilecek rolü ekler veya kaldırır.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Başlangıç rolü').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('kara-liste-kanal')
        .setDescription('XP kazanımının engellendiği kanalı ekler veya kaldırır.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('kara-liste-rol')
        .setDescription('XP kazanımının engellendiği rolü ekler veya kaldırır.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-spam')
        .setDescription('Anti-spam sistemini yapılandırır.')
        .addBooleanOption(opt => opt.setName('aktif').setDescription('Anti-spam aktif mi?').setRequired(true))
        .addIntegerOption(opt => opt.setName('mesaj-limiti').setDescription('Dakika başına maksimum mesaj').setRequired(false).setMinValue(1).setMaxValue(60))
        .addIntegerOption(opt => opt.setName('ses-hop-limiti').setDescription('Hızlı kanal değiştirme limiti').setRequired(false).setMinValue(1).setMaxValue(20))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

    // --- GORUNTULE ---
    if (sub === 'goruntule') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('⚙️ Evil Mega Corp // Sistem Konfigürasyonu')
        .addFields(
          {
            name: '📢 Kanal Ayarları',
            value: [
              `**Log Kanalı:** ${guildData.logChannel ? `<#${guildData.logChannel}>` : '❌ Ayarlanmamış'}`,
              `**Bildirim Kanalı:** ${guildData.notificationChannel ? `<#${guildData.notificationChannel}>` : '❌ Ayarlanmamış'}`,
              `**Bildirim Durumu:** ${guildData.notificationsEnabled !== false ? '✅ Açık' : '❌ Kapalı'}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚡ XP Ayarları',
            value: [
              `**XP Çarpanı:** x${guildData.xpMultiplier}`,
              `**Kara Liste Kanalları:** ${guildData.blacklistedChannels?.length || 0} adet`,
              `**Kara Liste Rolleri:** ${guildData.blacklistedRoles?.length || 0} adet`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🛡️ Güvenlik',
            value: [
              `**Anti-Spam:** ${guildData.antiSpam?.enabled !== false ? '✅ Açık' : '❌ Kapalı'}`,
              `**Mesaj Limiti:** ${guildData.antiSpam?.maxMessagesPerMinute || 15}/dk`,
              `**Ses Hop Limiti:** ${guildData.antiSpam?.voiceHopLimit || 5}/dk`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🏢 Departman Yapısı',
            value: [
              `**Yazı Hattı Rolleri:** ${guildData.levelRolesText?.length || 0} kademe`,
              `**Ses Hattı Rolleri:** ${guildData.levelRolesVoice?.length || 0} kademe`,
              `**Başlangıç Rolleri:** ${guildData.startingRoles?.map(r => `<@&${r}>`).join(', ') || 'Yok'}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '👋 Karşılayıcı Sistemi',
            value: [
              `**Hoş Geldin:** ${guildData.welcomeEnabled ? '✅ Açık' : '❌ Kapalı'}${guildData.welcomeChannel ? ` → <#${guildData.welcomeChannel}>` : ''}`,
              `**Gönderim:** ${guildData.welcomeSendDM ? '📬 DM' : '📢 Kanal'}`,
              `**Ayrılma:** ${guildData.leaveEnabled ? '✅ Açık' : '❌ Kapalı'}${guildData.leaveChannel ? ` → <#${guildData.leaveChannel}>` : ''}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🎙️ Ses Koşulları',
            value: [
              `**Mute İzin Seviyesi:** Lv.${guildData.voiceConditions?.muteAllowedLevel || 0}`,
              `**Deafen İzin Seviyesi:** Lv.${guildData.voiceConditions?.deafenAllowedLevel || 0}`,
              `**Solo XP Seviyesi:** Lv.${guildData.voiceConditions?.soloXpLevel || 0}`,
              `**AFK XP:** ${guildData.voiceConditions?.afkXpAllowed ? '✅ Açık' : '❌ Kapalı'}`,
              `**Min. Kişi Sayısı:** ${guildData.voiceConditions?.minUsersForXp || 2}`,
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- LOG KANAL ---
    if (sub === 'log-kanal') {
      const kanal = interaction.options.getChannel('kanal');
      const old = guildData.logChannel;
      guildData.logChannel = kanal.id;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayar Değişimi: Log Kanalı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Eski', value: old ? `<#${old}>` : 'Yok', inline: true },
          { name: 'Yeni', value: kanal.toString(), inline: true },
        ],
      });

      return interaction.reply({ content: `✅ Log kanalı ${kanal} olarak ayarlandı.`, ephemeral: true });
    }

    // --- BILDIRIM KANAL ---
    if (sub === 'bildirim-kanal') {
      const kanal = interaction.options.getChannel('kanal');
      const old = guildData.notificationChannel;
      guildData.notificationChannel = kanal.id;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayar Değişimi: Bildirim Kanalı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Eski', value: old ? `<#${old}>` : 'Yok', inline: true },
          { name: 'Yeni', value: kanal.toString(), inline: true },
        ],
      });

      return interaction.reply({ content: `✅ Bildirim kanalı ${kanal} olarak ayarlandı.`, ephemeral: true });
    }

    // --- BILDIRIM DURUM ---
    if (sub === 'bildirim-durum') {
      const aktif = interaction.options.getBoolean('aktif');
      guildData.notificationsEnabled = aktif;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayar Değişimi: Bildirim Durumu',
        operatorId: interaction.user.id,
        fields: [{ name: 'Yeni Durum', value: aktif ? '✅ Açık' : '❌ Kapalı', inline: true }],
      });

      return interaction.reply({ content: `✅ Bildirimler ${aktif ? '**açıldı**' : '**kapatıldı**'}.`, ephemeral: true });
    }

    // --- BILDIRIM MESAJI ---
    if (sub === 'bildirim-mesaji') {
      const hat = interaction.options.getString('hat');
      const sablon = interaction.options.getString('sablon');
      const field = hat === 'text' ? 'notificationTemplateText' : 'notificationTemplateVoice';

      const old = guildData[field];
      guildData[field] = sablon;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayar Değişimi: Bildirim Mesajı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Hat', value: hat === 'text' ? 'Yazı' : 'Ses', inline: true },
          { name: 'Yeni Şablon', value: sablon.substring(0, 200), inline: false },
        ],
      });

      return interaction.reply({ content: `✅ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı bildirim mesajı güncellendi.\n\n**Önizleme:**\n${sablon.replace(/{user}/g, interaction.user.toString()).replace(/{oldLevel}/g, '4').replace(/{newLevel}/g, '5').replace(/{oldRole}/g, 'Stajyer').replace(/{newRole}/g, 'Uzman')}`, ephemeral: true });
    }

    // --- XP ETKINLIK ---
    if (sub === 'xp-etkinlik') {
      const carpan = interaction.options.getNumber('carpan');
      const old = guildData.xpMultiplier;
      guildData.xpMultiplier = carpan;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayar Değişimi: XP Çarpanı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Eski', value: `x${old}`, inline: true },
          { name: 'Yeni', value: `x${carpan}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ XP çarpanı **x${carpan}** olarak ayarlandı.${carpan > 1 ? ' 🎉 XP etkinliği aktif!' : ''}`, ephemeral: true });
    }

    // --- BASLANGIC ROL ---
    if (sub === 'baslangic-rol') {
      const rol = interaction.options.getRole('rol');
      const index = guildData.startingRoles.indexOf(rol.id);

      if (index > -1) {
        guildData.startingRoles.splice(index, 1);
        await guildData.save();

        await log(interaction.client, guildId, LogTier.OPERATIONAL, {
          title: 'Ayar Değişimi: Başlangıç Rolü Kaldırıldı',
          operatorId: interaction.user.id,
          roleId: rol.id,
        });

        return interaction.reply({ content: `✅ ${rol} başlangıç rollerinden kaldırıldı.`, ephemeral: true });
      } else {
        guildData.startingRoles.push(rol.id);
        await guildData.save();

        await log(interaction.client, guildId, LogTier.OPERATIONAL, {
          title: 'Ayar Değişimi: Başlangıç Rolü Eklendi',
          operatorId: interaction.user.id,
          roleId: rol.id,
        });

        return interaction.reply({ content: `✅ ${rol} başlangıç rollerine eklendi.`, ephemeral: true });
      }
    }

    // --- KARA LISTE KANAL ---
    if (sub === 'kara-liste-kanal') {
      const kanal = interaction.options.getChannel('kanal');
      const index = guildData.blacklistedChannels.indexOf(kanal.id);

      if (index > -1) {
        guildData.blacklistedChannels.splice(index, 1);
        await guildData.save();
        return interaction.reply({ content: `✅ ${kanal} kara listeden kaldırıldı. XP kazanımı tekrar aktif.`, ephemeral: true });
      } else {
        guildData.blacklistedChannels.push(kanal.id);
        await guildData.save();
        return interaction.reply({ content: `✅ ${kanal} kara listeye eklendi. Bu kanalda XP kazanılmayacak.`, ephemeral: true });
      }
    }

    // --- KARA LISTE ROL ---
    if (sub === 'kara-liste-rol') {
      const rol = interaction.options.getRole('rol');
      if (!guildData.blacklistedRoles) guildData.blacklistedRoles = [];
      const index = guildData.blacklistedRoles.indexOf(rol.id);

      if (index > -1) {
        guildData.blacklistedRoles.splice(index, 1);
        await guildData.save();

        await log(interaction.client, guildId, LogTier.OPERATIONAL, {
          title: 'Ayar Değişimi: Kara Liste Rolü Kaldırıldı',
          operatorId: interaction.user.id,
          roleId: rol.id,
        });

        return interaction.reply({ content: `✅ ${rol} kara listeden kaldırıldı. Bu role sahip üyeler tekrar XP kazanabilir.`, ephemeral: true });
      } else {
        guildData.blacklistedRoles.push(rol.id);
        await guildData.save();

        await log(interaction.client, guildId, LogTier.OPERATIONAL, {
          title: 'Ayar Değişimi: Kara Liste Rolü Eklendi',
          operatorId: interaction.user.id,
          roleId: rol.id,
        });

        return interaction.reply({ content: `✅ ${rol} kara listeye eklendi. Bu role sahip üyeler XP kazanamayacak.`, ephemeral: true });
      }
    }

    // --- ANTI-SPAM ---
    if (sub === 'anti-spam') {
      const aktif = interaction.options.getBoolean('aktif');
      const mesajLimiti = interaction.options.getInteger('mesaj-limiti');
      const sesHopLimiti = interaction.options.getInteger('ses-hop-limiti');

      guildData.antiSpam.enabled = aktif;
      if (mesajLimiti) guildData.antiSpam.maxMessagesPerMinute = mesajLimiti;
      if (sesHopLimiti) guildData.antiSpam.voiceHopLimit = sesHopLimiti;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Ayar Değişimi: Anti-Spam',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Durum', value: aktif ? '✅ Açık' : '❌ Kapalı', inline: true },
          { name: 'Mesaj Limiti', value: `${guildData.antiSpam.maxMessagesPerMinute}/dk`, inline: true },
          { name: 'Ses Hop Limiti', value: `${guildData.antiSpam.voiceHopLimit}/dk`, inline: true },
        ],
      });

      return interaction.reply({
        content: `✅ Anti-spam ${aktif ? '**açıldı**' : '**kapatıldı**'}.\n` +
          `📝 Mesaj limiti: **${guildData.antiSpam.maxMessagesPerMinute}/dk**\n` +
          `🎙️ Ses hop limiti: **${guildData.antiSpam.voiceHopLimit}/dk**`,
        ephemeral: true,
      });
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

const VARIABLES_WELCOME = [
  '`[user]` — Yeni üyeyi etiketler',
  '`[userName]` — Etiketlemeden üyenin ismi',
  '`[memberCount]` — Ulaşılan üye sayısı',
  '`[server]` — Sunucu ismi',
];

const VARIABLES_LEAVE = [
  '`[user]` — Üyeyi etiketler',
  '`[userName]` — Etiketlemeden üyenin ismi',
  '`[memberCount]` — Güncel üye sayısı',
  '`[server]` — Sunucu ismi',
];

function applyVariables(template, member) {
  return template
    .replace(/\[user\]/g, `<@${member.id}>`)
    .replace(/\[userName\]/g, member.user?.username || member.username || 'Bilinmiyor')
    .replace(/\[memberCount\]/g, `${member.guild.memberCount}`)
    .replace(/\[server\]/g, member.guild.name);
}

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('karsilayici')
    .setDescription('Hoş geldin ve ayrılma mesaj sistemi.')
    .addSubcommand(sub =>
      sub.setName('hosgeldin-durum')
        .setDescription('Hoş geldin mesaj sistemini aç/kapat.')
        .addBooleanOption(opt => opt.setName('aktif').setDescription('Sistem aktif mi?').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hosgeldin-kanal')
        .setDescription('Hoş geldin mesajının gönderileceği kanalı ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Hoş geldin kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('hosgeldin-mesaj')
        .setDescription('Hoş geldin mesaj şablonunu değiştir.')
        .addStringOption(opt => opt.setName('mesaj').setDescription('Mesaj şablonu ([user], [userName], [memberCount], [server])').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hosgeldin-gonder')
        .setDescription('Hoş geldin mesajının gönderim yöntemini ayarla.')
        .addStringOption(opt =>
          opt.setName('yontem')
            .setDescription('Gönderim yöntemi')
            .setRequired(true)
            .addChoices(
              { name: 'Kanala Gönder', value: 'channel' },
              { name: 'DM Olarak Gönder', value: 'dm' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('ayrilma-durum')
        .setDescription('Ayrılma mesaj sistemini aç/kapat.')
        .addBooleanOption(opt => opt.setName('aktif').setDescription('Sistem aktif mi?').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ayrilma-kanal')
        .setDescription('Ayrılma mesajının gönderileceği kanalı ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Ayrılma mesaj kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('ayrilma-mesaj')
        .setDescription('Ayrılma mesaj şablonunu değiştir.')
        .addStringOption(opt => opt.setName('mesaj').setDescription('Mesaj şablonu ([user], [userName], [memberCount], [server])').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('onizleme')
        .setDescription('Mevcut hoş geldin ve ayrılma mesajlarının önizlemesini gösterir.')
    )
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Tüm karşılayıcı ayarlarını varsayılana döndürür.')
        .addStringOption(opt =>
          opt.setName('hedef')
            .setDescription('Neyi sıfırlayacaksınız?')
            .setRequired(true)
            .addChoices(
              { name: 'Hoş Geldin Mesajı', value: 'welcome' },
              { name: 'Ayrılma Mesajı', value: 'leave' },
              { name: 'Tümü', value: 'all' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('goruntule')
        .setDescription('Karşılayıcı sistem ayarlarını görüntüle.')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

    // --- HOSGELDIN DURUM ---
    if (sub === 'hosgeldin-durum') {
      const aktif = interaction.options.getBoolean('aktif');
      guildData.welcomeEnabled = aktif;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Hoş Geldin Durumu',
        operatorId: interaction.user.id,
        fields: [{ name: 'Durum', value: aktif ? '✅ Açık' : '❌ Kapalı', inline: true }],
      });

      return interaction.reply({
        content: `✅ Hoş geldin mesaj sistemi ${aktif ? '**açıldı**' : '**kapatıldı**'}.${aktif && !guildData.welcomeChannel ? '\n⚠️ Henüz hoş geldin kanalı ayarlanmamış! `/karsilayici hosgeldin-kanal` ile ayarlayın.' : ''}`,
        ephemeral: true,
      });
    }

    // --- HOSGELDIN KANAL ---
    if (sub === 'hosgeldin-kanal') {
      const kanal = interaction.options.getChannel('kanal');
      const old = guildData.welcomeChannel;
      guildData.welcomeChannel = kanal.id;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Hoş Geldin Kanalı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Eski', value: old ? `<#${old}>` : 'Yok', inline: true },
          { name: 'Yeni', value: kanal.toString(), inline: true },
        ],
      });

      return interaction.reply({ content: `✅ Hoş geldin kanalı ${kanal} olarak ayarlandı.`, ephemeral: true });
    }

    // --- HOSGELDIN MESAJ ---
    if (sub === 'hosgeldin-mesaj') {
      const mesaj = interaction.options.getString('mesaj');
      guildData.welcomeMessage = mesaj;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Hoş Geldin Mesajı Güncellendi',
        operatorId: interaction.user.id,
      });

      // Onizleme
      const preview = applyVariables(mesaj, interaction.member);

      return interaction.reply({
        content: `✅ Hoş geldin mesajı güncellendi.\n\n**Önizleme:**\n${preview.substring(0, 1800)}`,
        ephemeral: true,
      });
    }

    // --- HOSGELDIN GONDER ---
    if (sub === 'hosgeldin-gonder') {
      const yontem = interaction.options.getString('yontem');
      guildData.welcomeSendDM = yontem === 'dm';
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Gönderim Yöntemi',
        operatorId: interaction.user.id,
        fields: [{ name: 'Yöntem', value: yontem === 'dm' ? 'DM Olarak Gönder' : 'Kanala Gönder', inline: true }],
      });

      return interaction.reply({
        content: `✅ Hoş geldin mesajı ${yontem === 'dm' ? '**DM olarak**' : '**kanala**'} gönderilecek.`,
        ephemeral: true,
      });
    }

    // --- AYRILMA DURUM ---
    if (sub === 'ayrilma-durum') {
      const aktif = interaction.options.getBoolean('aktif');
      guildData.leaveEnabled = aktif;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Ayrılma Durumu',
        operatorId: interaction.user.id,
        fields: [{ name: 'Durum', value: aktif ? '✅ Açık' : '❌ Kapalı', inline: true }],
      });

      return interaction.reply({
        content: `✅ Ayrılma mesaj sistemi ${aktif ? '**açıldı**' : '**kapatıldı**'}.${aktif && !guildData.leaveChannel ? '\n⚠️ Henüz ayrılma kanalı ayarlanmamış! `/karsilayici ayrilma-kanal` ile ayarlayın.' : ''}`,
        ephemeral: true,
      });
    }

    // --- AYRILMA KANAL ---
    if (sub === 'ayrilma-kanal') {
      const kanal = interaction.options.getChannel('kanal');
      const old = guildData.leaveChannel;
      guildData.leaveChannel = kanal.id;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Ayrılma Kanalı',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Eski', value: old ? `<#${old}>` : 'Yok', inline: true },
          { name: 'Yeni', value: kanal.toString(), inline: true },
        ],
      });

      return interaction.reply({ content: `✅ Ayrılma mesaj kanalı ${kanal} olarak ayarlandı.`, ephemeral: true });
    }

    // --- AYRILMA MESAJ ---
    if (sub === 'ayrilma-mesaj') {
      const mesaj = interaction.options.getString('mesaj');
      guildData.leaveMessage = mesaj;
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Ayrılma Mesajı Güncellendi',
        operatorId: interaction.user.id,
      });

      const preview = applyVariables(mesaj, interaction.member);

      return interaction.reply({
        content: `✅ Ayrılma mesajı güncellendi.\n\n**Önizleme:**\n${preview.substring(0, 1800)}`,
        ephemeral: true,
      });
    }

    // --- ONIZLEME ---
    if (sub === 'onizleme') {
      const welcomePreview = applyVariables(guildData.welcomeMessage, interaction.member);
      const leavePreview = applyVariables(guildData.leaveMessage, interaction.member);

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('👁️ Evil Mega Corp // Karşılayıcı Önizleme')
        .addFields(
          {
            name: `${guildData.welcomeEnabled ? '✅' : '❌'} Hoş Geldin Mesajı`,
            value: welcomePreview.substring(0, 1024),
            inline: false,
          },
          {
            name: `${guildData.leaveEnabled ? '✅' : '❌'} Ayrılma Mesajı`,
            value: leavePreview.substring(0, 1024),
            inline: false,
          },
          {
            name: '⚙️ Ayarlar',
            value: [
              `**Hoş Geldin Kanalı:** ${guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '❌ Ayarlanmamış'}`,
              `**Gönderim:** ${guildData.welcomeSendDM ? 'DM' : 'Kanal'}`,
              `**Ayrılma Kanalı:** ${guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '❌ Ayarlanmamış'}`,
            ].join('\n'),
            inline: false,
          }
        )
        .addFields({
          name: '📌 Kullanılabilir Değişkenler',
          value: VARIABLES_WELCOME.join('\n'),
          inline: false,
        })
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- SIFIRLA ---
    if (sub === 'sifirla') {
      const hedef = interaction.options.getString('hedef');

      // Varsayilan mesajlari Guild modelinden al
      const defaults = new Guild().toObject();

      if (hedef === 'welcome' || hedef === 'all') {
        guildData.welcomeMessage = defaults.welcomeMessage;
        guildData.welcomeEnabled = false;
        guildData.welcomeChannel = null;
        guildData.welcomeSendDM = false;
      }

      if (hedef === 'leave' || hedef === 'all') {
        guildData.leaveMessage = defaults.leaveMessage;
        guildData.leaveEnabled = false;
        guildData.leaveChannel = null;
      }

      await guildData.save();

      const hedefText = { welcome: 'Hoş geldin', leave: 'Ayrılma', all: 'Tüm karşılayıcı' };

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Karşılayıcı: Ayarlar Sıfırlandı',
        operatorId: interaction.user.id,
        fields: [{ name: 'Hedef', value: hedefText[hedef], inline: true }],
      });

      return interaction.reply({
        content: `✅ ${hedefText[hedef]} ayarları varsayılana döndürüldü ve devre dışı bırakıldı.`,
        ephemeral: true,
      });
    }

    // --- GORUNTULE ---
    if (sub === 'goruntule') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📋 Evil Mega Corp // Karşılayıcı Ayarları')
        .addFields(
          {
            name: '👋 Hoş Geldin Sistemi',
            value: [
              `**Durum:** ${guildData.welcomeEnabled ? '✅ Açık' : '❌ Kapalı'}`,
              `**Kanal:** ${guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '❌ Ayarlanmamış'}`,
              `**Gönderim:** ${guildData.welcomeSendDM ? '📬 DM' : '📢 Kanal'}`,
              `**Mesaj Uzunluğu:** ${guildData.welcomeMessage?.length || 0} karakter`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🚪 Ayrılma Sistemi',
            value: [
              `**Durum:** ${guildData.leaveEnabled ? '✅ Açık' : '❌ Kapalı'}`,
              `**Kanal:** ${guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '❌ Ayarlanmamış'}`,
              `**Mesaj Uzunluğu:** ${guildData.leaveMessage?.length || 0} karakter`,
            ].join('\n'),
            inline: true,
          }
        )
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

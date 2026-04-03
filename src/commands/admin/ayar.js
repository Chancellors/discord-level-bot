const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('ayar')
    .setDescription('Sistem konfigürasyonunu yönetin.')
    .addSubcommand(sub =>
      sub.setName('log-kanal')
        .setDescription('Log kanalını ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Log kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('bildirim-kanal')
        .setDescription('Bildirim kanalını ayarla.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Bildirim kanalı').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('bildirim-mesaji')
        .setDescription('Bildirim mesaj şablonunu değiştir.')
        .addStringOption(opt => opt.setName('hat').setDescription('Hat').setRequired(true).addChoices({ name: 'Yazı', value: 'text' }, { name: 'Ses', value: 'voice' }))
        .addStringOption(opt => opt.setName('sablon').setDescription('Mesaj şablonu ({user}, {oldLevel}, {newLevel}, {oldRole}, {newRole})').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('xp-etkinlik')
        .setDescription('XP çarpanını ayarla.')
        .addNumberOption(opt => opt.setName('carpan').setDescription('Çarpan değeri (ör: 1.5, 2.0)').setRequired(true).setMinValue(0.1).setMaxValue(10))
    )
    .addSubcommand(sub =>
      sub.setName('baslangic-rol')
        .setDescription('Başlangıç rolü ekle/kaldır.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('kara-liste')
        .setDescription('XP kazanımı engellenecek kanal ekle/kaldır.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

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
          { name: 'Eski Şablon', value: old.substring(0, 200), inline: false },
          { name: 'Yeni Şablon', value: sablon.substring(0, 200), inline: false },
        ],
      });

      return interaction.reply({ content: `✅ ${hat === 'text' ? 'Yazı' : 'Ses'} Hattı bildirim mesajı güncellendi.`, ephemeral: true });
    }

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

      return interaction.reply({ content: `✅ XP çarpanı **x${carpan}** olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'baslangic-rol') {
      const rol = interaction.options.getRole('rol');
      const index = guildData.startingRoles.indexOf(rol.id);

      if (index > -1) {
        guildData.startingRoles.splice(index, 1);
        await guildData.save();
        return interaction.reply({ content: `✅ ${rol} başlangıç rollerinden kaldırıldı.`, ephemeral: true });
      } else {
        guildData.startingRoles.push(rol.id);
        await guildData.save();
        return interaction.reply({ content: `✅ ${rol} başlangıç rollerine eklendi.`, ephemeral: true });
      }
    }

    if (sub === 'kara-liste') {
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
  },
};

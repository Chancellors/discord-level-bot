const { SlashCommandBuilder, EmbedBuilder, ActivityType, version } = require('discord.js');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const os = require('os');

module.exports = {
  category: 'dev',
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot profil ve aktivite yönetimi.')
    .addSubcommand(sub =>
      sub.setName('durum')
        .setDescription('Bot durumunu değiştir.')
        .addStringOption(opt =>
          opt.setName('tip')
            .setDescription('Durum tipi')
            .setRequired(true)
            .addChoices(
              { name: 'Çevrimiçi', value: 'online' },
              { name: 'Boşta', value: 'idle' },
              { name: 'Rahatsız Etmeyin', value: 'dnd' },
              { name: 'Görünmez', value: 'invisible' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('etkinlik')
        .setDescription('Bot aktivitesini değiştir.')
        .addStringOption(opt =>
          opt.setName('tip')
            .setDescription('Aktivite tipi')
            .setRequired(true)
            .addChoices(
              { name: 'İzliyor', value: 'watching' },
              { name: 'Oynuyor', value: 'playing' },
              { name: 'Dinliyor', value: 'listening' },
              { name: 'Yarışıyor', value: 'competing' }
            )
        )
        .addStringOption(opt => opt.setName('metin').setDescription('Aktivite metni').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('bilgi')
        .setDescription('Detaylı bot ve altyapı bilgileri.')
    )
    .addSubcommand(sub =>
      sub.setName('ping')
        .setDescription('Bot gecikme sürelerini ölç.')
    )
    .addSubcommand(sub =>
      sub.setName('sunucular')
        .setDescription('Botun bulunduğu tüm sunucuların listesi.')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'durum') {
      const tip = interaction.options.getString('tip');
      client.user.setStatus(tip);

      const statusNames = { online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız Etmeyin', invisible: 'Görünmez' };

      await log(client, interaction.guild.id, LogTier.SHADOW, {
        title: 'Bot Durumu Değiştirildi',
        operatorId: interaction.user.id,
        fields: [{ name: 'Yeni Durum', value: statusNames[tip], inline: true }],
      });

      return interaction.reply({ content: `✅ Bot durumu **${statusNames[tip]}** olarak ayarlandı.`, ephemeral: true });
    }

    if (sub === 'etkinlik') {
      const tip = interaction.options.getString('tip');
      const metin = interaction.options.getString('metin');

      const typeMap = {
        watching: ActivityType.Watching,
        playing: ActivityType.Playing,
        listening: ActivityType.Listening,
        competing: ActivityType.Competing,
      };

      const tipNames = { watching: 'İzliyor', playing: 'Oynuyor', listening: 'Dinliyor', competing: 'Yarışıyor' };

      client.user.setActivity(metin, { type: typeMap[tip] });

      await log(client, interaction.guild.id, LogTier.SHADOW, {
        title: 'Bot Etkinliği Değiştirildi',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Tip', value: tipNames[tip], inline: true },
          { name: 'Metin', value: metin, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ Bot etkinliği: **${tipNames[tip]}** — ${metin}`, ephemeral: true });
    }

    if (sub === 'bilgi') {
      await interaction.deferReply({ ephemeral: true });

      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const totalUsers = await User.countDocuments();
      const totalGuilds = await Guild.countDocuments();
      const memUsage = process.memoryUsage();

      const dbStatus = mongoose.connection.readyState;
      const dbStatusText = { 0: '❌ Bağlantı Yok', 1: '✅ Bağlı', 2: '🔄 Bağlanıyor', 3: '⚠️ Kesiliyor' };

      // Oturum bilgileri
      const voiceSessions = client.voiceSessions?.size || 0;
      const cooldowns = client.cooldowns?.size || 0;
      const ghostCount = client.ghostMode?.size || 0;

      const embed = new EmbedBuilder()
        .setColor(config.colors.prestige)
        .setTitle('🏢 Evil Mega Corp // Bot Detay Raporu')
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: '🤖 Kimlik',
            value: [
              `**Ad:** ${client.user.tag}`,
              `**ID:** ${client.user.id}`,
              `**Oluşturma:** <t:${Math.floor(client.user.createdTimestamp / 1000)}:R>`,
              `**Çalışma Süresi:** ${hours}s ${minutes}dk ${seconds}sn`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📊 İstatistikler',
            value: [
              `**Sunucu:** ${client.guilds.cache.size}`,
              `**Kullanıcı (cache):** ${client.users.cache.size}`,
              `**Kanal (cache):** ${client.channels.cache.size}`,
              `**Kayıtlı (DB):** ${totalUsers} kullanıcı / ${totalGuilds} sunucu`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🛠️ Motor',
            value: [
              `**Discord.js:** v${version}`,
              `**Node.js:** ${process.version}`,
              `**OS:** ${os.platform()} ${os.arch()}`,
              `**MongoDB:** ${dbStatusText[dbStatus]}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '💻 Kaynak Kullanımı',
            value: [
              `**Heap:** ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} / ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
              `**RSS:** ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
              `**Sistem RAM:** ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚙️ Çalışma Durumu',
            value: [
              `**Bakım Modu:** ${client.maintenanceMode ? '🔧 AKTİF' : '✅ Kapalı'}`,
              `**Ses Oturumları:** ${voiceSessions}`,
              `**Cooldown Kayıtları:** ${cooldowns}`,
              `**Ghost Mode:** ${ghostCount} dev`,
              `**Komut Sayısı:** ${client.commands.size}`,
              `**Ping:** ${client.ws.ping}ms`,
            ].join('\n'),
            inline: true,
          }
        )
        .setFooter({ text: 'Evil Mega Corp // Shadow Authority Division' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'ping') {
      const start = Date.now();
      await interaction.deferReply({ ephemeral: true });
      const apiLatency = Date.now() - start;
      const wsLatency = client.ws.ping;

      // DB ping
      let dbLatency = -1;
      try {
        const dbStart = Date.now();
        await mongoose.connection.db.admin().ping();
        dbLatency = Date.now() - dbStart;
      } catch { /* ignore */ }

      const getIndicator = (ms) => {
        if (ms < 0) return '❓';
        if (ms < 100) return '🟢';
        if (ms < 250) return '🟡';
        return '🔴';
      };

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🏓 Evil Mega Corp // Ping Raporu')
        .addFields(
          { name: `${getIndicator(apiLatency)} API Gecikme`, value: `**${apiLatency}ms**`, inline: true },
          { name: `${getIndicator(wsLatency)} WebSocket`, value: `**${wsLatency}ms**`, inline: true },
          { name: `${getIndicator(dbLatency)} MongoDB`, value: dbLatency >= 0 ? `**${dbLatency}ms**` : '**N/A**', inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Shadow Authority' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'sunucular') {
      const guilds = client.guilds.cache
        .sort((a, b) => b.memberCount - a.memberCount)
        .map((g, i) => `**${i + 1}.** ${g.name} — ${g.memberCount} üye`)
        .slice(0, 25);

      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🌐 Evil Mega Corp // Sunucu Listesi')
        .setDescription(guilds.join('\n') || 'Sunucu yok.')
        .addFields({
          name: '📈 Toplam',
          value: `**${client.guilds.cache.size}** sunucu, **${totalMembers}** toplam üye`,
          inline: false,
        })
        .setFooter({ text: 'Evil Mega Corp // Shadow Authority' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

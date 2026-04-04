const { SlashCommandBuilder, EmbedBuilder, ActivityType } = require('discord.js');
const config = require('../../config');
const { isDev } = require('../../utils/permissions');

const ACTIVITY_MAP = {
  izliyor: ActivityType.Watching,
  dinliyor: ActivityType.Listening,
  oynuyor: ActivityType.Playing,
  yarisiyor: ActivityType.Competing,
};

module.exports = {
  category: 'dev',
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot yonetim komutlari.')
    .addSubcommand(sub =>
      sub.setName('durum')
        .setDescription('Bot aktivitesini ayarla.')
        .addStringOption(opt => opt.setName('aktivite').setDescription('Aktivite metni').setRequired(true))
        .addStringOption(opt =>
          opt.setName('tip').setDescription('Aktivite tipi').setRequired(true)
            .addChoices(
              { name: 'Izliyor', value: 'izliyor' },
              { name: 'Dinliyor', value: 'dinliyor' },
              { name: 'Oynuyor', value: 'oynuyor' },
              { name: 'Yarisiyor', value: 'yarisiyor' },
            )))
    .addSubcommand(sub =>
      sub.setName('bilgi')
        .setDescription('Bot hakkinda genel bilgi.'))
    .addSubcommand(sub =>
      sub.setName('sunucular')
        .setDescription('Botun bulundugu sunuculari listele.'))
    .addSubcommand(sub =>
      sub.setName('ping')
        .setDescription('WebSocket ve API gecikme suresi.')),

  async execute(interaction, client) {
    if (!isDev(interaction.user.id)) {
      return interaction.reply({ content: '`ERISIM REDDEDILDI` // Yetkiniz yok.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    // ── durum ──
    if (sub === 'durum') {
      const aktivite = interaction.options.getString('aktivite');
      const tip = interaction.options.getString('tip');

      client.user.setActivity(aktivite, { type: ACTIVITY_MAP[tip] });

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle('`BOT DURUMU GUNCELLENDI`')
        .setDescription(`Aktivite: **${tip.charAt(0).toUpperCase() + tip.slice(1)}** — ${aktivite}`)
        .setFooter({ text: 'Evil Mega Corp // Bot Yonetimi' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── bilgi ──
    if (sub === 'bilgi') {
      const guilds = client.guilds.cache;
      const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
      const totalChannels = guilds.reduce((acc, g) => acc + g.channels.cache.size, 0);
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('`BOT BILGI RAPORU`')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: 'Sunucu', value: `${guilds.size}`, inline: true },
          { name: 'Toplam Uye', value: `${totalMembers.toLocaleString('tr-TR')}`, inline: true },
          { name: 'Kanal', value: `${totalChannels}`, inline: true },
          { name: 'Komut Sayisi', value: `${client.commands.size}`, inline: true },
          { name: 'Calisma Suresi', value: `${hours}s ${minutes}d ${seconds}sn`, inline: true },
          { name: 'WS Ping', value: `${client.ws.ping}ms`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Sistem Istihbarati' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── sunucular ──
    if (sub === 'sunucular') {
      const guilds = client.guilds.cache
        .sort((a, b) => b.memberCount - a.memberCount)
        .map((g, i) => `**${g.name}** — ${g.memberCount.toLocaleString('tr-TR')} uye`);

      const lines = guilds.slice(0, 25);
      const description = lines.join('\n') + (guilds.length > 25 ? `\n\n...ve ${guilds.length - 25} sunucu daha.` : '');

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('`SUNUCU LISTESI`')
        .setDescription(description || 'Sunucu bulunamadi.')
        .setFooter({ text: `Evil Mega Corp // Toplam: ${guilds.length} sunucu` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── ping ──
    if (sub === 'ping') {
      const sent = await interaction.reply({ content: '`Olculuyor...`', ephemeral: true, fetchReply: true });
      const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('`GECIKME RAPORU`')
        .addFields(
          { name: 'WebSocket Heartbeat', value: `${client.ws.ping}ms`, inline: true },
          { name: 'API Gecikmesi', value: `${apiLatency}ms`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Ag Izleme' })
        .setTimestamp();

      return interaction.editReply({ content: null, embeds: [embed] });
    }
  },
};

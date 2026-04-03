const { SlashCommandBuilder, ActivityType } = require('discord.js');
const { log, LogTier } = require('../../utils/logger');

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
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'durum') {
      const tip = interaction.options.getString('tip');
      client.user.setStatus(tip);

      await log(client, interaction.guild.id, LogTier.SHADOW, {
        title: 'Bot Durumu Değiştirildi',
        operatorId: interaction.user.id,
        fields: [{ name: 'Yeni Durum', value: tip, inline: true }],
      });

      return interaction.reply({ content: `✅ Bot durumu **${tip}** olarak ayarlandı.`, ephemeral: true });
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

      client.user.setActivity(metin, { type: typeMap[tip] });

      await log(client, interaction.guild.id, LogTier.SHADOW, {
        title: 'Bot Etkinliği Değiştirildi',
        operatorId: interaction.user.id,
        fields: [
          { name: 'Tip', value: tip, inline: true },
          { name: 'Metin', value: metin, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ Bot etkinliği: **${tip}** — ${metin}`, ephemeral: true });
    }
  },
};

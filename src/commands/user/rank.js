const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const db = require('../../database/queries');
const config = require('../../config');
const { xpForLevel, levelForXP } = require('../../systems/xpEngine');
const { formatDuration } = require('../../utils/timeParser');

function progressBar(current, max, length = 10) {
  const filled = Math.round((current / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = {
  category: 'user',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Kullanicinin seviye kartini goster.')
    .addUserOption(opt =>
      opt.setName('kullanici').setDescription('Bilgilerini goruntulemek istediginiz kullanici').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('kullanici') || interaction.user;
    const guildId = interaction.guild.id;

    const userData = await cache.getUser(target.id, guildId);
    if (!userData) {
      return interaction.reply({ content: 'Kullanici verisi bulunamadi.', ephemeral: true });
    }

    const [voiceRank, textRank] = await Promise.all([
      db.getUserRank(target.id, guildId, 'xp_ses'),
      db.getUserRank(target.id, guildId, 'xp_yazi'),
    ]);

    const voiceXP = userData.xp_ses || 0;
    const textXP = userData.xp_yazi || 0;
    const voiceLevel = levelForXP(voiceXP);
    const textLevel = levelForXP(textXP);

    const voiceNextLevelXP = xpForLevel(voiceLevel + 1);
    const textNextLevelXP = xpForLevel(textLevel + 1);
    const voiceCurrentLevelXP = xpForLevel(voiceLevel);
    const textCurrentLevelXP = xpForLevel(textLevel);

    const voiceProgress = voiceXP - voiceCurrentLevelXP;
    const voiceNeeded = voiceNextLevelXP - voiceCurrentLevelXP;
    const textProgress = textXP - textCurrentLevelXP;
    const textNeeded = textNextLevelXP - textCurrentLevelXP;

    const totalMinutes = userData.total_minutes_voice || 0;
    const totalWords = userData.total_words_text || 0;

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setTitle('Personel Dosyasi')
      .addFields(
        {
          name: 'Ses Hatti',
          value: [
            `Seviye: **${voiceLevel}** | Siralama: **#${voiceRank ?? '?'}**`,
            `XP: **${voiceXP}** / ${voiceNextLevelXP}`,
            `${progressBar(voiceProgress, voiceNeeded)} (${voiceNeeded - voiceProgress} XP kaldi)`,
            `Toplam Sure: **${formatDuration(totalMinutes)}**`,
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Yazi Hatti',
          value: [
            `Seviye: **${textLevel}** | Siralama: **#${textRank ?? '?'}**`,
            `XP: **${textXP}** / ${textNextLevelXP}`,
            `${progressBar(textProgress, textNeeded)} (${textNeeded - textProgress} XP kaldi)`,
            `Toplam Kelime: **${totalWords.toLocaleString('tr-TR')}**`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Evil Mega Corp // Personel Izleme Sistemi' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

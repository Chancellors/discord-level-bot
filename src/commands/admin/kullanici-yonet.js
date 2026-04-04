const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const queries = require('../../database/queries');
const { parseTime, formatDuration, minutesToLevel } = require('../../utils/timeParser');
const { log, LogTier } = require('../../utils/logger');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('kullanici-yonet')
    .setDescription('Kullanıcı yönetim komutları.')
    .addSubcommand(sub =>
      sub.setName('bilgi')
        .setDescription('Kullanıcının tam profilini göster.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sifirla')
        .setDescription('Kullanıcının XP\'sini sıfırla.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('askiya-al')
        .setDescription('Kullanıcıyı XP kazanmaktan askıya al.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('sure').setDescription('Süre (ör: 3g, 1h)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('askidan-al')
        .setDescription('Kullanıcının askısını kaldır.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sure-ekle')
        .setDescription('Kullanıcıya süre/XP ekle.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true)
          .addChoices({ name: 'Ses', value: 'ses' }, { name: 'Yazı', value: 'yazi' }))
        .addStringOption(opt => opt.setName('sure').setDescription('Eklenecek süre (ör: 1h 3g)').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sure-cikar')
        .setDescription('Kullanıcıdan süre/XP çıkar.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('hat').setDescription('Hat türü').setRequired(true)
          .addChoices({ name: 'Ses', value: 'ses' }, { name: 'Yazı', value: 'yazi' }))
        .addStringOption(opt => opt.setName('sure').setDescription('Çıkarılacak süre (ör: 1h 3g)').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('sicil')
        .setDescription('Kullanıcının sicil kayıtlarını göster.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('kayit-ekle')
        .setDescription('Manuel sicil kaydı ekle.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('aksiyon').setDescription('Aksiyon türü').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'bilgi') {
      const user = interaction.options.getUser('kullanici');
      const userData = await queries.getUser(user.id, guildId);
      if (!userData) {
        return interaction.reply({ content: '❌ Bu kullanıcının verisi bulunamadı.', ephemeral: true });
      }

      const records = await queries.getRecords(user.id, guildId, 5);
      const recordLines = records && records.length > 0
        ? records.map(r => `• **${r.action}** — ${r.reason} (<t:${Math.floor(new Date(r.created_at || Date.now()).getTime() / 1000)}:R>)`).join('\n')
        : 'Kayıt yok';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`📋 Personel Dosyası: ${user.username}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: '🎙️ Ses XP', value: `${userData.xp_ses || 0}`, inline: true },
          { name: '📝 Yazı XP', value: `${userData.xp_yazi || 0}`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '🎙️ Ses Seviyesi', value: `${userData.level_ses || 0}`, inline: true },
          { name: '📝 Yazı Seviyesi', value: `${userData.level_yazi || 0}`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '⏱️ Toplam Ses Süresi', value: userData.total_minutes_voice ? formatDuration(userData.total_minutes_voice) : '0', inline: true },
          { name: '📝 Toplam Kelime', value: `${userData.total_words_text || 0}`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '⏸️ Askıda', value: userData.askida ? `Evet (${userData.askiya_bitis ? `<t:${Math.floor(new Date(userData.askiya_bitis).getTime() / 1000)}:R> bitiyor` : 'Süresiz'})` : 'Hayır', inline: false },
          { name: '📜 Son Kayıtlar', value: recordLines, inline: false },
        )
        .setFooter({ text: 'Evil Mega Corp // Personel Dosyası' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'sifirla') {
      const user = interaction.options.getUser('kullanici');
      await queries.updateUser(user.id, guildId, {
        xp_ses: 0, xp_yazi: 0, level_ses: 0, level_yazi: 0,
        total_minutes_voice: 0, total_words_text: 0,
      });

      const cached = await cache.getUser(user.id, guildId);
      if (cached) {
        cached.xp_ses = 0; cached.xp_yazi = 0;
        cached.level_ses = 0; cached.level_yazi = 0;
        cached.total_minutes_voice = 0; cached.total_words_text = 0;
        cache.setUser(user.id, guildId, cached);
      }

      await queries.addRecord(user.id, guildId, 'XP Sıfırlama', `Yetkili tarafından sıfırlandı.`, interaction.user.id);
      await interaction.reply({ content: `✅ **${user.username}** kullanıcısının tüm XP verileri sıfırlandı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'XP Sıfırlama',
        description: `${user.username} (${user.id}) XP verileri sıfırlandı.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'askiya-al') {
      const user = interaction.options.getUser('kullanici');
      const sureStr = interaction.options.getString('sure');
      let bitis = null;

      if (sureStr) {
        const minutes = parseTime(sureStr);
        if (minutes === null) {
          return interaction.reply({ content: '❌ Geçersiz süre formatı. Örnek: `3g`, `1h 2g`', ephemeral: true });
        }
        bitis = new Date(Date.now() + minutes * 60000).toISOString();
      }

      await queries.updateUser(user.id, guildId, {
        askida: true,
        askiya_alan: interaction.user.id,
        askiya_tarihi: new Date().toISOString(),
        askiya_bitis: bitis,
      });

      const cached = await cache.getUser(user.id, guildId);
      if (cached) {
        cached.askida = true;
        cached.askiya_alan = interaction.user.id;
        cached.askiya_tarihi = new Date().toISOString();
        cached.askiya_bitis = bitis;
        cache.setUser(user.id, guildId, cached);
      }

      await queries.addRecord(user.id, guildId, 'Askıya Alma', `${sureStr ? formatDuration(parseTime(sureStr)) + ' süreyle' : 'Süresiz'} askıya alındı.`, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle('⏸️ Kullanıcı Askıya Alındı')
        .setDescription(`**${user.username}** XP kazanmaktan askıya alındı.`)
        .addFields(
          { name: 'Süre', value: sureStr ? formatDuration(parseTime(sureStr)) : 'Süresiz', inline: true },
          { name: 'Bitiş', value: bitis ? `<t:${Math.floor(new Date(bitis).getTime() / 1000)}:F>` : 'Belirsiz', inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Askıya Alma' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Askıya Alma',
        description: `${user.username} askıya alındı.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'askidan-al') {
      const user = interaction.options.getUser('kullanici');
      await queries.updateUser(user.id, guildId, {
        askida: false, askiya_alan: null, askiya_tarihi: null, askiya_bitis: null,
      });

      const cached = await cache.getUser(user.id, guildId);
      if (cached) {
        cached.askida = false;
        cached.askiya_alan = null;
        cached.askiya_tarihi = null;
        cached.askiya_bitis = null;
        cache.setUser(user.id, guildId, cached);
      }

      await queries.addRecord(user.id, guildId, 'Askıdan Alma', 'Askı kaldırıldı.', interaction.user.id);
      await interaction.reply({ content: `✅ **${user.username}** askıdan alındı.`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Askıdan Alma',
        description: `${user.username} askıdan alındı.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'sure-ekle' || sub === 'sure-cikar') {
      const user = interaction.options.getUser('kullanici');
      const hat = interaction.options.getString('hat');
      const sureStr = interaction.options.getString('sure');
      const minutes = parseTime(sureStr);

      if (minutes === null) {
        return interaction.reply({ content: '❌ Geçersiz süre formatı. Örnek: `1h 3g`, `2a`', ephemeral: true });
      }

      const isAdd = sub === 'sure-ekle';
      const xpField = hat === 'ses' ? 'xp_ses' : 'xp_yazi';
      const minuteField = hat === 'ses' ? 'total_minutes_voice' : 'total_words_text';
      const levelField = hat === 'ses' ? 'level_ses' : 'level_yazi';

      // Calculate XP: voice = 15 XP/min, text = 5 XP/word => use minutes as time equivalent
      const xpAmount = hat === 'ses' ? minutes * config.xp.voice : minutes * config.xp.text;
      const amount = isAdd ? xpAmount : -xpAmount;

      const userData = await queries.getUser(user.id, guildId);
      if (!userData) {
        return interaction.reply({ content: '❌ Bu kullanıcının verisi bulunamadı.', ephemeral: true });
      }

      const currentXP = userData[xpField] || 0;
      const newXP = Math.max(0, currentXP + amount);
      const newLevel = Math.floor(newXP / 100);

      const currentMinutes = hat === 'ses' ? (userData.total_minutes_voice || 0) : (userData.total_words_text || 0);
      const newMinutes = Math.max(0, currentMinutes + (isAdd ? minutes : -minutes));

      await queries.updateUser(user.id, guildId, {
        [xpField]: newXP,
        [levelField]: newLevel,
        [minuteField]: newMinutes,
      });

      const cached = await cache.getUser(user.id, guildId);
      if (cached) {
        cached[xpField] = newXP;
        cached[levelField] = newLevel;
        cached[minuteField] = newMinutes;
        cache.setUser(user.id, guildId, cached);
      }

      const actionName = isAdd ? 'Süre Ekleme' : 'Süre Çıkarma';
      await queries.addRecord(user.id, guildId, actionName, `${hat === 'ses' ? 'Ses' : 'Yazı'} hattına ${formatDuration(minutes)} ${isAdd ? 'eklendi' : 'çıkarıldı'}.`, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(config.colors.operational)
        .setTitle(`✅ ${actionName}`)
        .setDescription(`**${user.username}** kullanıcısına ${hat === 'ses' ? 'ses' : 'yazı'} hattında ${formatDuration(minutes)} ${isAdd ? 'eklendi' : 'çıkarıldı'}.`)
        .addFields(
          { name: 'XP Değişimi', value: `${currentXP} → ${newXP}`, inline: true },
          { name: 'Seviye', value: `${newLevel}`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Süre Yönetimi' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: actionName,
        description: `${user.username} — ${hat} hattında ${formatDuration(minutes)} ${isAdd ? 'eklendi' : 'çıkarıldı'}.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'sicil') {
      const user = interaction.options.getUser('kullanici');
      const records = await queries.getRecords(user.id, guildId, 20);

      if (!records || records.length === 0) {
        return interaction.reply({ content: `📭 **${user.username}** için sicil kaydı bulunamadı.`, ephemeral: true });
      }

      const lines = records.map((r, i) => {
        const ts = r.created_at ? `<t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>` : '';
        return `**${i + 1}.** ${r.action} — ${r.reason} ${ts}`;
      });

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`📜 Sicil Kayıtları: ${user.username}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Toplam ${records.length} kayıt` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'kayit-ekle') {
      const user = interaction.options.getUser('kullanici');
      const aksiyon = interaction.options.getString('aksiyon');
      const sebep = interaction.options.getString('sebep');

      await queries.addRecord(user.id, guildId, aksiyon, sebep, interaction.user.id);
      await interaction.reply({ content: `✅ **${user.username}** için sicil kaydı eklendi: **${aksiyon}** — ${sebep}`, ephemeral: true });

      log(client, guildId, LogTier.OPERATIONAL, {
        title: 'Sicil Kaydı Eklendi',
        description: `${user.username} — ${aksiyon}: ${sebep}`,
        operatorId: interaction.user.id,
      });
    }
  },
};

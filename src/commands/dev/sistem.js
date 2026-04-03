const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Guild = require('../../models/Guild');

module.exports = {
  category: 'dev',
  data: new SlashCommandBuilder()
    .setName('sistem')
    .setDescription('Shadow Authority sistem komutları.')
    .addSubcommand(sub =>
      sub.setName('bakim-modu')
        .setDescription('Bakım modunu aç/kapat.')
    )
    .addSubcommand(sub =>
      sub.setName('komut-yenile')
        .setDescription('Komut dosyalarını önbellekten temizleyip yeniden yükle.')
    )
    .addSubcommand(sub =>
      sub.setName('kod-calistir')
        .setDescription('JavaScript kodu çalıştır (eval).')
        .addStringOption(opt => opt.setName('kod').setDescription('Çalıştırılacak kod').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('hayalet-modu')
        .setDescription('Ghost modu aç/kapat - loglanmadan işlem yap.')
    )
    .addSubcommand(sub =>
      sub.setName('veritabani-durum')
        .setDescription('MongoDB bağlantı durumu ve koleksiyon istatistikleri.')
    )
    .addSubcommand(sub =>
      sub.setName('acil-yedekle')
        .setDescription('Tüm sunucu verilerini JSON olarak dışa aktar.')
        .addStringOption(opt =>
          opt.setName('hedef')
            .setDescription('Yedek hedefi')
            .setRequired(false)
            .addChoices(
              { name: 'Sadece Bu Sunucu', value: 'guild' },
              { name: 'Tüm Veriler', value: 'all' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('bellek')
        .setDescription('Bellek kullanımı ve cache durumu.')
    )
    .addSubcommand(sub =>
      sub.setName('cooldown-temizle')
        .setDescription('Tüm cooldown verilerini sıfırla.')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'bakim-modu') {
      client.maintenanceMode = !client.maintenanceMode;
      const durum = client.maintenanceMode ? 'AKTİF' : 'KAPALI';

      await log(client, guildId, LogTier.SHADOW, {
        title: `Bakım Modu: ${durum}`,
        description: `Sistem bakım moduna ${client.maintenanceMode ? 'alındı' : 'çıkarıldı'}.`,
        operatorId: interaction.user.id,
      });

      return interaction.reply({
        content: `🔧 Bakım modu: **${durum}**\n${client.maintenanceMode ? 'Tüm kullanıcı komutları devre dışı.' : 'Sistem normal çalışmaya devam ediyor.'}`,
        ephemeral: true,
      });
    }

    if (sub === 'komut-yenile') {
      const reloaded = [];
      const errors = [];
      const commandsDir = path.join(__dirname, '..');

      function reloadDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            reloadDir(fullPath);
          } else if (entry.name.endsWith('.js')) {
            try {
              delete require.cache[require.resolve(fullPath)];
              const cmd = require(fullPath);
              if (cmd.data && cmd.execute) {
                client.commands.set(cmd.data.name, cmd);
                reloaded.push(cmd.data.name);
              }
            } catch (err) {
              errors.push(`${entry.name}: ${err.message}`);
            }
          }
        }
      }

      reloadDir(commandsDir);

      await log(client, guildId, LogTier.SHADOW, {
        title: 'Komut Yenileme (Reload)',
        description: `${reloaded.length} komut yeniden yüklendi.${errors.length ? ` ${errors.length} hata.` : ''}`,
        operatorId: interaction.user.id,
      });

      let response = `🔄 **${reloaded.length}** komut yeniden yüklendi:\n${reloaded.map(n => `\`/${n}\``).join(', ')}`;
      if (errors.length) {
        response += `\n\n⚠️ **${errors.length} Hata:**\n${errors.map(e => `\`${e}\``).join('\n')}`;
      }

      return interaction.reply({ content: response, ephemeral: true });
    }

    if (sub === 'kod-calistir') {
      const kod = interaction.options.getString('kod');

      await log(client, guildId, LogTier.SHADOW, {
        title: 'Eval Çalıştırma',
        description: `\`\`\`js\n${kod.substring(0, 1000)}\n\`\`\``,
        operatorId: interaction.user.id,
      });

      try {
        let result = eval(kod);
        if (result instanceof Promise) result = await result;
        const output = typeof result === 'string' ? result : require('util').inspect(result, { depth: 1 });

        await log(client, guildId, LogTier.SHADOW, {
          title: 'Eval Çıktısı',
          description: `\`\`\`js\n${output.substring(0, 1500)}\n\`\`\``,
          operatorId: interaction.user.id,
        });

        return interaction.reply({ content: `📤 **Çıktı:**\n\`\`\`js\n${output.substring(0, 1800)}\n\`\`\``, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `❌ **Hata:**\n\`\`\`\n${err.message.substring(0, 1800)}\n\`\`\``, ephemeral: true });
      }
    }

    if (sub === 'hayalet-modu') {
      const isGhost = client.ghostMode.has(interaction.user.id);

      if (isGhost) {
        client.ghostMode.delete(interaction.user.id);

        await log(client, guildId, LogTier.SHADOW, {
          title: 'Hayalet Modu: KAPANDI',
          description: 'Geliştirici görünür moda döndü.',
          operatorId: interaction.user.id,
        });

        return interaction.reply({ content: '👻 Hayalet modu **kapatıldı**. İşlemleriniz tekrar loglanacak.', ephemeral: true });
      } else {
        await log(client, guildId, LogTier.SHADOW, {
          title: 'Hayalet Modu: AKTIF',
          description: 'Geliştirici hayalet moduna geçti. İşlemler loglanmayacak.',
          operatorId: interaction.user.id,
        });

        client.ghostMode.add(interaction.user.id);
        return interaction.reply({ content: '👻 Hayalet modu **aktif**. İşlemleriniz loglanmayacak.', ephemeral: true });
      }
    }

    if (sub === 'veritabani-durum') {
      await interaction.deferReply({ ephemeral: true });

      const dbStatus = mongoose.connection.readyState;
      const dbStatusText = { 0: '❌ Bağlantı Yok', 1: '✅ Bağlı', 2: '🔄 Bağlanıyor', 3: '⚠️ Bağlantı Kesiliyor' };

      // Koleksiyon istatistikleri
      const totalUsers = await User.countDocuments();
      const totalGuilds = await Guild.countDocuments();
      const frozenUsers = await User.countDocuments({ frozen: true });

      // Bu sunucu
      const guildUsers = await User.countDocuments({ guildId });
      const guildActiveUsers = await User.countDocuments({
        guildId,
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      });

      // Boyut tahmini
      let dbStats = null;
      try {
        dbStats = await mongoose.connection.db.stats();
      } catch { /* ignore */ }

      const embed = new EmbedBuilder()
        .setColor(dbStatus === 1 ? config.colors.personnel : config.colors.security)
        .setTitle('🗄️ Evil Mega Corp // Veritabanı Durumu')
        .addFields(
          {
            name: '📡 Bağlantı',
            value: [
              `**Durum:** ${dbStatusText[dbStatus] || '❓ Bilinmiyor'}`,
              `**Host:** ${mongoose.connection.host || 'N/A'}`,
              `**DB Adı:** ${mongoose.connection.name || 'N/A'}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📊 Global İstatistik',
            value: [
              `**Toplam Kullanıcı:** ${totalUsers}`,
              `**Toplam Sunucu:** ${totalGuilds}`,
              `**Dondurulmuş:** ${frozenUsers}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🏢 Bu Sunucu',
            value: [
              `**Kayıtlı:** ${guildUsers}`,
              `**Aktif (7 gün):** ${guildActiveUsers}`,
            ].join('\n'),
            inline: true,
          }
        );

      if (dbStats) {
        embed.addFields({
          name: '💾 Depolama',
          value: [
            `**Veri Boyutu:** ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`,
            `**Depo Boyutu:** ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`,
            `**Index Boyutu:** ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`,
            `**Koleksiyon Sayısı:** ${dbStats.collections}`,
          ].join('\n'),
          inline: false,
        });
      }

      embed.setFooter({ text: 'Evil Mega Corp // Shadow Authority' }).setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'acil-yedekle') {
      const hedef = interaction.options.getString('hedef') || 'guild';
      await interaction.deferReply({ ephemeral: true });

      try {
        let backupData;

        if (hedef === 'guild') {
          const guildData = await Guild.findOne({ guildId }).lean();
          const users = await User.find({ guildId }).lean();
          backupData = {
            _meta: {
              type: 'guild_backup',
              guildId,
              timestamp: new Date().toISOString(),
              userCount: users.length,
            },
            guild: guildData,
            users,
          };
        } else {
          const allGuilds = await Guild.find().lean();
          const allUsers = await User.find().lean();
          backupData = {
            _meta: {
              type: 'full_backup',
              timestamp: new Date().toISOString(),
              guildCount: allGuilds.length,
              userCount: allUsers.length,
            },
            guilds: allGuilds,
            users: allUsers,
          };
        }

        const json = JSON.stringify(backupData, null, 2);
        const buffer = Buffer.from(json, 'utf-8');
        const filename = `backup_${hedef}_${Date.now()}.json`;

        await log(client, guildId, LogTier.SHADOW, {
          title: 'Acil Yedekleme',
          description: `${hedef === 'all' ? 'Tam sistem' : 'Sunucu'} yedeği oluşturuldu.`,
          operatorId: interaction.user.id,
          fields: [
            { name: 'Boyut', value: `${(buffer.length / 1024).toFixed(1)} KB`, inline: true },
            { name: 'Hedef', value: hedef === 'all' ? 'Tüm Veriler' : 'Bu Sunucu', inline: true },
          ],
        });

        return interaction.editReply({
          content: `✅ Yedekleme tamamlandı. **${(buffer.length / 1024).toFixed(1)} KB** veri dışa aktarıldı.`,
          files: [{ attachment: buffer, name: filename }],
        });
      } catch (err) {
        return interaction.editReply({ content: `❌ Yedekleme hatası: ${err.message}` });
      }
    }

    if (sub === 'bellek') {
      const memUsage = process.memoryUsage();
      const os = require('os');

      const voiceSessionCount = client.voiceSessions?.size || 0;
      const cooldownCount = client.cooldowns?.size || 0;
      const guildCacheSize = client.guilds.cache.size;
      const userCacheSize = client.users.cache.size;
      const channelCacheSize = client.channels.cache.size;

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🧠 Evil Mega Corp // Bellek & Cache Durumu')
        .addFields(
          {
            name: '💻 Process Bellek',
            value: [
              `**Heap Kullanılan:** ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
              `**Heap Toplam:** ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
              `**RSS:** ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
              `**External:** ${(memUsage.external / 1024 / 1024).toFixed(1)} MB`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🖥️ Sistem Bellek',
            value: [
              `**Toplam:** ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
              `**Boş:** ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
              `**Kullanım:** ${((1 - os.freemem() / os.totalmem()) * 100).toFixed(1)}%`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📦 Discord.js Cache',
            value: [
              `**Sunucular:** ${guildCacheSize}`,
              `**Kullanıcılar:** ${userCacheSize}`,
              `**Kanallar:** ${channelCacheSize}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '⚙️ Bot Cache',
            value: [
              `**Ses Oturumları:** ${voiceSessionCount}`,
              `**Cooldown Kayıtları:** ${cooldownCount}`,
              `**Ghost Mode:** ${client.ghostMode.size} geliştirici`,
              `**Komut Sayısı:** ${client.commands.size}`,
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: `Uptime: ${Math.floor(process.uptime() / 3600)}s ${Math.floor((process.uptime() % 3600) / 60)}dk` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'cooldown-temizle') {
      const count = client.cooldowns?.size || 0;
      if (client.cooldowns) client.cooldowns.clear();

      await log(client, guildId, LogTier.SHADOW, {
        title: 'Cooldown Verileri Temizlendi',
        description: `${count} cooldown kaydı silindi.`,
        operatorId: interaction.user.id,
      });

      return interaction.reply({
        content: `🗑️ **${count}** cooldown kaydı temizlendi. Tüm kullanıcılar sıfırdan başlayacak.`,
        ephemeral: true,
      });
    }
  },
};

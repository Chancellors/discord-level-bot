const { SlashCommandBuilder, EmbedBuilder, codeBlock } = require('discord.js');
const path = require('path');
const cache = require('../../cache/manager');
const { query } = require('../../database/pool');
const config = require('../../config');
const { isDev } = require('../../utils/permissions');

module.exports = {
  category: 'dev',
  data: new SlashCommandBuilder()
    .setName('sistem')
    .setDescription('Sistem yonetim komutlari.')
    .addSubcommand(sub =>
      sub.setName('bakim')
        .setDescription('Bakim modunu ac/kapat.')
        .addBooleanOption(opt => opt.setName('durum').setDescription('Bakim modu durumu').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('ghost')
        .setDescription('Ghost modunu ac/kapat (log gizleme).')
        .addBooleanOption(opt => opt.setName('durum').setDescription('Ghost modu durumu').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('db-durum')
        .setDescription('Veritabani durum bilgisi.'))
    .addSubcommand(sub =>
      sub.setName('flush')
        .setDescription('Onbellegi veritabanina yazdir.'))
    .addSubcommand(sub =>
      sub.setName('bellek')
        .setDescription('Bellek kullanimi ve sistem bilgisi.'))
    .addSubcommand(sub =>
      sub.setName('yeniden-yukle')
        .setDescription('Bir komutu yeniden yukle.')
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adi').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('eval')
        .setDescription('JavaScript kodu calistir.')
        .addStringOption(opt => opt.setName('kod').setDescription('Calistirilacak kod').setRequired(true))),

  async execute(interaction, client) {
    if (!isDev(interaction.user.id)) {
      return interaction.reply({ content: '`ERISIM REDDEDILDI` // Yetkiniz yok.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    // ── bakim ──
    if (sub === 'bakim') {
      const durum = interaction.options.getBoolean('durum');
      client.maintenanceMode = durum;

      const embed = new EmbedBuilder()
        .setColor(durum ? config.colors.security : config.colors.operational)
        .setTitle(durum ? '`BAKIM MODU AKTIF`' : '`BAKIM MODU DEAKTIF`')
        .setDescription(durum
          ? 'Sistem bakim moduna alindi. Kullanici komutlari devre disi.'
          : 'Bakim modu kapatildi. Sistem normal operasyona dondu.')
        .setFooter({ text: 'Evil Mega Corp // Sistem Yonetimi' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── ghost ──
    if (sub === 'ghost') {
      const durum = interaction.options.getBoolean('durum');
      if (durum) {
        client.ghostMode.add(interaction.user.id);
      } else {
        client.ghostMode.delete(interaction.user.id);
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.shadow)
        .setTitle(durum ? '`GHOST MOD AKTIF`' : '`GHOST MOD DEAKTIF`')
        .setDescription(durum
          ? 'Eylemleriniz artik loglardan gizlenecek.'
          : 'Ghost mod kapatildi. Eylemler tekrar loglanacak.')
        .setFooter({ text: 'Evil Mega Corp // Golge Operasyonlari' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── db-durum ──
    if (sub === 'db-durum') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const start = Date.now();
        await query('SELECT 1');
        const ping = Date.now() - start;

        const tableResult = await query(
          "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'"
        );
        const tableCount = tableResult.rows[0].count;

        const embed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle('`VERITABANI DURUM RAPORU`')
          .addFields(
            { name: 'Baglanti', value: `\`${config.db.host}:${config.db.port}/${config.db.database}\``, inline: false },
            { name: 'Ping', value: `${ping}ms`, inline: true },
            { name: 'Tablo Sayisi', value: `${tableCount}`, inline: true },
            { name: 'Durum', value: 'Aktif', inline: true },
          )
          .setFooter({ text: 'Evil Mega Corp // Veritabani Izleme' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `\`VERITABANI HATASI\`\n${codeBlock(err.message)}` });
      }
    }

    // ── flush ──
    if (sub === 'flush') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const start = Date.now();
        await cache.flush();
        const duration = Date.now() - start;

        const embed = new EmbedBuilder()
          .setColor(config.colors.operational)
          .setTitle('`ONBELLEK YAZDIRILDI`')
          .setDescription(`Onbellek basariyla veritabanina yazdirildi. (${duration}ms)`)
          .setFooter({ text: 'Evil Mega Corp // Onbellek Yonetimi' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `\`FLUSH HATASI\`\n${codeBlock(err.message)}` });
      }
    }

    // ── bellek ──
    if (sub === 'bellek') {
      const mem = process.memoryUsage();
      const fmt = bytes => (bytes / 1024 / 1024).toFixed(2) + ' MB';
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('`SISTEM BELLEK RAPORU`')
        .addFields(
          { name: 'RSS', value: fmt(mem.rss), inline: true },
          { name: 'Heap Kullanilan', value: fmt(mem.heapUsed), inline: true },
          { name: 'Heap Toplam', value: fmt(mem.heapTotal), inline: true },
          { name: 'External', value: fmt(mem.external), inline: true },
          { name: 'Calisma Suresi', value: `${hours}s ${minutes}d ${seconds}sn`, inline: true },
          { name: 'Ses Oturumlari', value: `${client.voiceSessions.size}`, inline: true },
          { name: 'Onbellek (Sunucu)', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Onbellek (Komut)', value: `${client.commands.size}`, inline: true },
        )
        .setFooter({ text: 'Evil Mega Corp // Kaynak Izleme' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── yeniden-yukle ──
    if (sub === 'yeniden-yukle') {
      const komutAdi = interaction.options.getString('komut');
      const oldCommand = client.commands.get(komutAdi);

      if (!oldCommand) {
        return interaction.reply({ content: `\`HATA\` // \`${komutAdi}\` adinda komut bulunamadi.`, ephemeral: true });
      }

      // Find the file path by searching command directories
      const fs = require('fs');
      const commandsDir = path.join(__dirname, '..');
      let filePath = null;

      for (const folder of fs.readdirSync(commandsDir)) {
        const candidate = path.join(commandsDir, folder, `${komutAdi}.js`);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
          break;
        }
      }

      if (!filePath) {
        return interaction.reply({ content: `\`HATA\` // \`${komutAdi}.js\` dosyasi bulunamadi.`, ephemeral: true });
      }

      try {
        delete require.cache[require.resolve(filePath)];
        const newCommand = require(filePath);
        client.commands.set(newCommand.data.name, newCommand);

        const embed = new EmbedBuilder()
          .setColor(config.colors.operational)
          .setTitle('`KOMUT YENIDEN YUKLENDI`')
          .setDescription(`\`/${komutAdi}\` basariyla yeniden yuklendi.`)
          .setFooter({ text: 'Evil Mega Corp // Komut Yonetimi' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `\`YUKLEME HATASI\`\n${codeBlock(err.message)}`, ephemeral: true });
      }
    }

    // ── eval ──
    if (sub === 'eval') {
      if (!config.devIds.includes(interaction.user.id)) {
        return interaction.reply({ content: '`ERISIM REDDEDILDI` // Eval yetkisi yok.', ephemeral: true });
      }

      const kod = interaction.options.getString('kod');
      await interaction.deferReply({ ephemeral: true });

      let result;
      try {
        // Provide useful variables in eval scope
        /* eslint-disable no-unused-vars */
        const db = require('../../database/pool');
        const c = cache;
        const cfg = config;
        /* eslint-enable no-unused-vars */

        result = await eval(kod);
        if (typeof result !== 'string') result = require('util').inspect(result, { depth: 2 });
      } catch (err) {
        result = `Hata: ${err.message}`;
      }

      if (result.length > 2000) result = result.slice(0, 1997) + '...';

      return interaction.editReply({ content: codeBlock('js', result) });
    }
  },
};

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');
const path = require('path');
const fs = require('fs');

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
      const commandsDir = path.join(__dirname, '..');

      function reloadDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            reloadDir(fullPath);
          } else if (entry.name.endsWith('.js')) {
            delete require.cache[require.resolve(fullPath)];
            const cmd = require(fullPath);
            if (cmd.data && cmd.execute) {
              client.commands.set(cmd.data.name, cmd);
              reloaded.push(cmd.data.name);
            }
          }
        }
      }

      reloadDir(commandsDir);

      await log(client, guildId, LogTier.SHADOW, {
        title: 'Komut Yenileme (Reload)',
        description: `${reloaded.length} komut yeniden yüklendi.`,
        operatorId: interaction.user.id,
        fields: [{ name: 'Dosyalar', value: reloaded.map(n => `\`${n}\``).join(', ') || 'Yok', inline: false }],
      });

      return interaction.reply({ content: `🔄 **${reloaded.length}** komut yeniden yüklendi:\n${reloaded.map(n => `\`/${n}\``).join(', ')}`, ephemeral: true });
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
        // Ghost mode basladiktan sonra log yazilmaz, once baslangici logla
        await log(client, guildId, LogTier.SHADOW, {
          title: 'Hayalet Modu: AKTIF',
          description: 'Geliştirici hayalet moduna geçti. İşlemler loglanmayacak.',
          operatorId: interaction.user.id,
        });

        client.ghostMode.add(interaction.user.id);
        return interaction.reply({ content: '👻 Hayalet modu **aktif**. İşlemleriniz loglanmayacak.', ephemeral: true });
      }
    }
  },
};

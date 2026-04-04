const { REST, Routes } = require('discord.js');
const config = require('../config');
const cache = require('../cache/manager');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Bot] ${client.user.tag} olarak giris yapildi.`);

    // DND durumu ayarla
    client.user.setPresence({ status: 'dnd', activities: [{ name: 'Mutlak Gözetim', type: 3 }] });

    // Cache baslat
    await cache.init(client);

    // Slash komutlari kaydet
    const commands = client.commands.map(c => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      console.log(`[Deploy] ${commands.length} komut kaydediliyor...`);
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log('[Deploy] Komutlar basariyla kaydedildi.');
    } catch (err) {
      console.error('[Deploy] Komut kaydi basarisiz:', err.message);
    }

    // Role Guard baslat
    const roleGuard = require('../systems/roleGuard');
    roleGuard.init(client);

    console.log('[Bot] Sistem tamamen hazir.');
  },
};

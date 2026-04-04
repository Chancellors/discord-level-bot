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
    const clientId = config.clientId || client.user.id;

    console.log(`[Deploy] Client ID: ${clientId}`);
    console.log(`[Deploy] ${commands.length} komut kaydediliyor...`);

    // Her sunucuya guild-specific kaydet (aninda guncellenir)
    for (const guild of client.guilds.cache.values()) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guild.id),
          { body: commands }
        );
        console.log(`[Deploy] ${guild.name} (${guild.id}) icin ${commands.length} komut kaydedildi.`);
      } catch (err) {
        console.error(`[Deploy] ${guild.name} komut kaydi basarisiz:`, err.message);
      }
    }

    // Ayrica global olarak da kaydet (yeni sunucular icin)
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('[Deploy] Global komutlar da kaydedildi.');
    } catch (err) {
      console.error('[Deploy] Global komut kaydi basarisiz:', err.message);
    }

    // Role Guard baslat
    const roleGuard = require('../systems/roleGuard');
    roleGuard.init(client);

    console.log('[Bot] Sistem tamamen hazir.');
  },
};

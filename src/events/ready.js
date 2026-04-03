const { ActivityType, REST, Routes } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Ready] ${client.user.tag} aktif! ${client.guilds.cache.size} sunucuda.`);

    client.user.setPresence({
      activities: [{ name: 'Mutlak Gözetim', type: ActivityType.Watching }],
      status: 'dnd',
    });

    // Slash komutlari kaydet
    const commands = client.commands.map(cmd => cmd.data.toJSON());
    const rest = new (require('@discordjs/rest').REST)().setToken(config.token);

    try {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log(`[Commands] ${commands.length} slash komutu kaydedildi.`);
    } catch (err) {
      console.error('[Commands] Komut kaydi basarisiz:', err);
    }
  },
};

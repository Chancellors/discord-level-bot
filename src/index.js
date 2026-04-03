require('dotenv/config');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.voiceSessions = new Collection(); // Ses oturumu takibi
client.ghostMode = new Set(); // Hayalet mod aktif dev ID'leri
client.maintenanceMode = false;

// --- Komut Yukleme ---
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

// --- Event Yukleme ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

// --- Sistem Yukleme ---
const systemsPath = path.join(__dirname, 'systems');
if (fs.existsSync(systemsPath)) {
  for (const file of fs.readdirSync(systemsPath).filter(f => f.endsWith('.js'))) {
    const system = require(path.join(systemsPath, file));
    if (typeof system.init === 'function') {
      system.init(client);
    }
  }
}

// --- MongoDB Baglantisi & Bot Baslatma ---
async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[MongoDB] Baglanti basarili.');

    await client.login(config.token);
    console.log(`[Bot] ${client.user.tag} olarak giris yapildi.`);
  } catch (err) {
    console.error('[FATAL] Baslangic hatasi:', err);
    process.exit(1);
  }
}

start();

module.exports = client;

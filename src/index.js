require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { initializeDatabase } = require('./database/schema');
const cache = require('./cache/manager');

// ─── Client ──────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.GuildMember, Partials.User],
});

// ─── Collections ─────────────────────────────────────────────────────────────

client.commands = new Collection();
client.voiceSessions = new Map();
client.ghostMode = new Set();
client.maintenanceMode = false;

// ─── Load Commands ───────────────────────────────────────────────────────────

const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
for (const folder of commandFolders) {
  const commandPath = path.join(__dirname, 'commands', folder);
  if (!fs.statSync(commandPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(commandPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`[Loader] Komut yuklendi: /${command.data.name}`);
    }
  }
}

// ─── Load Events ─────────────────────────────────────────────────────────────

const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(__dirname, 'events', file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[Loader] Event yuklendi: ${event.name}`);
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function start() {
  try {
    console.log('[Bot] Evil Mega Corp baslatiliyor...');

    // Initialize database
    await initializeDatabase();

    // Login
    await client.login(config.token);
  } catch (err) {
    console.error('[Bot] Baslangic hatasi:', err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`[Bot] ${signal} sinyali alindi. Kapatiliyor...`);

  try {
    await cache.shutdown();
  } catch (err) {
    console.error('[Bot] Cache kapatma hatasi:', err.message);
  }

  try {
    client.destroy();
  } catch (err) {
    console.error('[Bot] Client kapatma hatasi:', err.message);
  }

  console.log('[Bot] Evil Mega Corp kapatildi.');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('message', msg => {
  if (msg === 'shutdown') shutdown('PM2');
});

// Unhandled errors
process.on('unhandledRejection', err => {
  console.error('[Bot] Unhandled rejection:', err);
});

process.on('uncaughtException', err => {
  console.error('[Bot] Uncaught exception:', err);
  shutdown('EXCEPTION');
});

start();

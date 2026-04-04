const queries = require('../database/queries');

// ─── In-Memory Cache ───────────────────────────────────────────────────────────

const guilds = new Map();      // guildId -> guild data object
const users = new Map();       // `${userId}_${guildId}` -> user data object
const dirtyGuilds = new Set(); // guild IDs that have been modified
const dirtyUsers = new Set();  // user keys that have been modified

let flushInterval = null;

const FLUSH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Guild Cache ───────────────────────────────────────────────────────────────

async function getGuild(guildId) {
  if (guilds.has(guildId)) {
    return guilds.get(guildId);
  }

  const guild = await queries.getGuild(guildId);
  if (guild) {
    guilds.set(guildId, guild);
  }
  return guild;
}

function setGuild(guildId, data) {
  guilds.set(guildId, data);
  dirtyGuilds.add(guildId);
}

function updateGuildField(guildId, field, value) {
  const guild = guilds.get(guildId);
  if (guild) {
    guild[field] = value;
    dirtyGuilds.add(guildId);
  }
}

// ─── User Cache ────────────────────────────────────────────────────────────────

function _userKey(userId, guildId) {
  return `${userId}_${guildId}`;
}

async function getUser(userId, guildId) {
  const key = _userKey(userId, guildId);
  if (users.has(key)) {
    return users.get(key);
  }

  const user = await queries.getUser(userId, guildId);
  if (user) {
    users.set(key, user);
  }
  return user;
}

function setUser(userId, guildId, data) {
  const key = _userKey(userId, guildId);
  users.set(key, data);
  dirtyUsers.add(key);
}

function addUserXP(userId, guildId, field, amount) {
  const key = _userKey(userId, guildId);
  const user = users.get(key);
  if (!user) return null;

  user[field] = (user[field] || 0) + amount;

  // Recalculate levels based on XP
  user.level_ses = Math.floor((user.xp_ses || 0) / 100);
  user.level_yazi = Math.floor((user.xp_yazi || 0) / 100);

  dirtyUsers.add(key);
  return user;
}

// ─── Flush ─────────────────────────────────────────────────────────────────────

async function flush() {
  const guildCount = dirtyGuilds.size;
  const userCount = dirtyUsers.size;

  if (guildCount === 0 && userCount === 0) return;

  // Snapshot and clear dirty sets before async work
  const guildIds = [...dirtyGuilds];
  const userKeys = [...dirtyUsers];
  dirtyGuilds.clear();
  dirtyUsers.clear();

  // Flush dirty guilds
  for (const guildId of guildIds) {
    try {
      const data = guilds.get(guildId);
      if (!data) continue;

      // Clone and remove non-updatable fields
      const fields = { ...data };
      delete fields.guild_id;
      delete fields.created_at;
      delete fields.updated_at;

      await queries.updateGuild(guildId, fields);
    } catch (err) {
      console.error(`[Cache] Guild flush error for ${guildId}:`, err.message);
      // Re-mark as dirty so it retries next cycle
      dirtyGuilds.add(guildId);
    }
  }

  // Flush dirty users
  for (const key of userKeys) {
    try {
      const data = users.get(key);
      if (!data) continue;

      const [userId, guildId] = [data.user_id, data.guild_id];

      const fields = {
        xp_ses: data.xp_ses,
        xp_yazi: data.xp_yazi,
        level_ses: data.level_ses,
        level_yazi: data.level_yazi,
        total_minutes_voice: data.total_minutes_voice,
        total_words_text: data.total_words_text,
        roles: data.roles,
      };

      await queries.updateUser(userId, guildId, fields);
    } catch (err) {
      console.error(`[Cache] User flush error for ${key}:`, err.message);
      dirtyUsers.add(key);
    }
  }

  console.log(`[Cache] Flushed ${guildCount} guilds, ${userCount} users to database.`);
}

async function flushCritical(userId, guildId) {
  const key = _userKey(userId, guildId);

  if (!dirtyUsers.has(key)) return;

  const data = users.get(key);
  if (!data) return;

  try {
    const fields = {
      xp_ses: data.xp_ses,
      xp_yazi: data.xp_yazi,
      level_ses: data.level_ses,
      level_yazi: data.level_yazi,
      total_minutes_voice: data.total_minutes_voice,
      total_words_text: data.total_words_text,
      roles: data.roles,
    };

    await queries.updateUser(userId, guildId, fields);
    dirtyUsers.delete(key);
  } catch (err) {
    console.error(`[Cache] Critical flush error for ${key}:`, err.message);
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

async function init(client) {
  console.log('[Cache] Initializing cache...');

  // Load all guilds into cache on startup
  try {
    const allGuilds = await queries.getAllGuilds();
    for (const guild of allGuilds) {
      guilds.set(guild.guild_id, guild);
    }
    console.log(`[Cache] Loaded ${allGuilds.length} guilds into cache.`);
  } catch (err) {
    console.error('[Cache] Failed to load guilds:', err.message);
  }

  // Start periodic flush
  flushInterval = setInterval(async () => {
    try {
      await flush();
    } catch (err) {
      console.error('[Cache] Periodic flush error:', err.message);
    }
  }, FLUSH_INTERVAL_MS);

  console.log('[Cache] Cache initialized. Flush interval: 30 minutes.');
}

async function shutdown() {
  console.log('[Cache] Shutting down cache...');

  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }

  try {
    await flush();
  } catch (err) {
    console.error('[Cache] Shutdown flush error:', err.message);
  }

  console.log('[Cache] Cache shutdown complete.');
}

module.exports = {
  init,
  getGuild,
  setGuild,
  updateGuildField,
  getUser,
  setUser,
  addUserXP,
  flush,
  flushCritical,
  shutdown,
};

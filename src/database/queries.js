const { query } = require('./pool');

// ─── Guild Functions ────────────────────────────────────────────────────────────

async function getGuild(guildId) {
  const result = await query(
    `INSERT INTO guilds (guild_id)
     VALUES ($1)
     ON CONFLICT (guild_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [guildId]
  );
  return result.rows[0];
}

async function updateGuild(guildId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const setClauses = keys.map((key, i) => `${key} = $${i + 2}`);
  setClauses.push('updated_at = NOW()');
  const values = keys.map((key) => fields[key]);

  const result = await query(
    `UPDATE guilds SET ${setClauses.join(', ')} WHERE guild_id = $1 RETURNING *`,
    [guildId, ...values]
  );
  return result.rows[0];
}

async function getAllGuilds() {
  const result = await query('SELECT * FROM guilds');
  return result.rows;
}

// ─── User Functions ─────────────────────────────────────────────────────────────

async function getUser(userId, guildId) {
  const result = await query(
    `INSERT INTO users (user_id, guild_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, guild_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [userId, guildId]
  );
  return result.rows[0];
}

async function updateUser(userId, guildId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const setClauses = keys.map((key, i) => `${key} = $${i + 3}`);
  setClauses.push('updated_at = NOW()');
  const values = keys.map((key) => fields[key]);

  const result = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE user_id = $1 AND guild_id = $2 RETURNING *`,
    [userId, guildId, ...values]
  );
  return result.rows[0];
}

async function incrementUserXP(userId, guildId, field, amount) {
  const result = await query(
    `UPDATE users SET ${field} = ${field} + $3, updated_at = NOW()
     WHERE user_id = $1 AND guild_id = $2
     RETURNING *`,
    [userId, guildId, amount]
  );
  return result.rows[0];
}

async function getLeaderboard(guildId, field, limit = 10, offset = 0) {
  const result = await query(
    `SELECT *, RANK() OVER (ORDER BY ${field} DESC) as rank
     FROM users
     WHERE guild_id = $1
     ORDER BY ${field} DESC
     LIMIT $2 OFFSET $3`,
    [guildId, limit, offset]
  );
  return result.rows;
}

async function getUserRank(userId, guildId, field) {
  const result = await query(
    `SELECT rank FROM (
       SELECT user_id, RANK() OVER (ORDER BY ${field} DESC) as rank
       FROM users
       WHERE guild_id = $2
     ) ranked
     WHERE user_id = $1`,
    [userId, guildId]
  );
  return result.rows[0]?.rank ?? null;
}

async function getActiveUsers(guildId, days = 30) {
  const result = await query(
    `SELECT * FROM users
     WHERE guild_id = $1 AND updated_at >= NOW() - INTERVAL '1 day' * $2`,
    [guildId, days]
  );
  return result.rows;
}

async function getAllGuildUsers(guildId) {
  const result = await query(
    'SELECT * FROM users WHERE guild_id = $1',
    [guildId]
  );
  return result.rows;
}

// ─── Level Role Functions ───────────────────────────────────────────────────────

async function getLevelRoles(guildId) {
  const result = await query(
    'SELECT * FROM level_roles WHERE guild_id = $1 ORDER BY ses_level ASC NULLS LAST',
    [guildId]
  );
  return result.rows;
}

async function addLevelRole(guildId, roleId, roleName, sesSure, yaziSure, sesLevel, yaziLevel, mod) {
  const result = await query(
    `INSERT INTO level_roles (guild_id, role_id, role_name, ses_sure, yazi_sure, ses_level, yazi_level, mod)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (guild_id, role_id) DO UPDATE SET
       role_name = EXCLUDED.role_name,
       ses_sure = EXCLUDED.ses_sure,
       yazi_sure = EXCLUDED.yazi_sure,
       ses_level = EXCLUDED.ses_level,
       yazi_level = EXCLUDED.yazi_level,
       mod = EXCLUDED.mod
     RETURNING *`,
    [guildId, roleId, roleName, sesSure, yaziSure, sesLevel, yaziLevel, mod]
  );
  return result.rows[0];
}

async function removeLevelRole(guildId, roleId) {
  const result = await query(
    'DELETE FROM level_roles WHERE guild_id = $1 AND role_id = $2 RETURNING *',
    [guildId, roleId]
  );
  return result.rows[0];
}

async function updateLevelRoleInitialized(guildId, roleId) {
  const result = await query(
    'UPDATE level_roles SET initialized = true WHERE guild_id = $1 AND role_id = $2 RETURNING *',
    [guildId, roleId]
  );
  return result.rows[0];
}

// ─── Record Functions ───────────────────────────────────────────────────────────

async function addRecord(userId, guildId, action, reason, operatorId) {
  const result = await query(
    `INSERT INTO records (user_id, guild_id, action, reason, operator_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, guildId, action, reason, operatorId]
  );
  return result.rows[0];
}

async function getRecords(userId, guildId, limit = 25) {
  const result = await query(
    `SELECT * FROM records
     WHERE user_id = $1 AND guild_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, guildId, limit]
  );
  return result.rows;
}

async function addKariyerSicili(userId, guildId, data) {
  const result = await query(
    `INSERT INTO kariyer_sicili (user_id, guild_id, eski_rol, yeni_rol, eski_level, yeni_level, hat, gecen_sure_gun, toplam_aktif_dakika)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      guildId,
      data.eski_rol,
      data.yeni_rol,
      data.eski_level,
      data.yeni_level,
      data.hat,
      data.gecen_sure_gun,
      data.toplam_aktif_dakika,
    ]
  );
  return result.rows[0];
}

// ─── Permission Functions ───────────────────────────────────────────────────────

async function getCommandPermissions(guildId) {
  const result = await query(
    'SELECT * FROM command_permissions WHERE guild_id = $1',
    [guildId]
  );
  return result.rows;
}

async function addCommandPermission(guildId, command, category, roleId) {
  const result = await query(
    `INSERT INTO command_permissions (guild_id, command, category, role_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, command, role_id) DO UPDATE SET category = EXCLUDED.category
     RETURNING *`,
    [guildId, command, category, roleId]
  );
  return result.rows[0];
}

async function removeCommandPermission(guildId, command, roleId) {
  const result = await query(
    'DELETE FROM command_permissions WHERE guild_id = $1 AND command = $2 AND role_id = $3 RETURNING *',
    [guildId, command, roleId]
  );
  return result.rows[0];
}

async function getUserBlacklist(guildId) {
  const result = await query(
    'SELECT * FROM user_command_blacklist WHERE guild_id = $1',
    [guildId]
  );
  return result.rows;
}

async function addUserBlacklist(guildId, userId, command) {
  const result = await query(
    `INSERT INTO user_command_blacklist (guild_id, user_id, command)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, user_id, command) DO NOTHING
     RETURNING *`,
    [guildId, userId, command]
  );
  return result.rows[0];
}

async function removeUserBlacklist(guildId, userId, command) {
  const result = await query(
    'DELETE FROM user_command_blacklist WHERE guild_id = $1 AND user_id = $2 AND command = $3 RETURNING *',
    [guildId, userId, command]
  );
  return result.rows[0];
}

async function getBlacklistedChannels(guildId) {
  const result = await query(
    'SELECT * FROM blacklisted_channels WHERE guild_id = $1',
    [guildId]
  );
  return result.rows;
}

async function addBlacklistedChannel(guildId, channelId) {
  const result = await query(
    `INSERT INTO blacklisted_channels (guild_id, channel_id)
     VALUES ($1, $2)
     ON CONFLICT (guild_id, channel_id) DO NOTHING
     RETURNING *`,
    [guildId, channelId]
  );
  return result.rows[0];
}

async function removeBlacklistedChannel(guildId, channelId) {
  const result = await query(
    'DELETE FROM blacklisted_channels WHERE guild_id = $1 AND channel_id = $2 RETURNING *',
    [guildId, channelId]
  );
  return result.rows[0];
}

async function getBlacklistedRoles(guildId) {
  const result = await query(
    'SELECT * FROM blacklisted_roles WHERE guild_id = $1',
    [guildId]
  );
  return result.rows;
}

async function addBlacklistedRole(guildId, roleId) {
  const result = await query(
    `INSERT INTO blacklisted_roles (guild_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (guild_id, role_id) DO NOTHING
     RETURNING *`,
    [guildId, roleId]
  );
  return result.rows[0];
}

async function removeBlacklistedRole(guildId, roleId) {
  const result = await query(
    'DELETE FROM blacklisted_roles WHERE guild_id = $1 AND role_id = $2 RETURNING *',
    [guildId, roleId]
  );
  return result.rows[0];
}

module.exports = {
  // Guild
  getGuild,
  updateGuild,
  getAllGuilds,
  // User
  getUser,
  updateUser,
  incrementUserXP,
  getLeaderboard,
  getUserRank,
  getActiveUsers,
  getAllGuildUsers,
  // Level Roles
  getLevelRoles,
  addLevelRole,
  removeLevelRole,
  updateLevelRoleInitialized,
  // Records
  addRecord,
  getRecords,
  addKariyerSicili,
  // Permissions
  getCommandPermissions,
  addCommandPermission,
  removeCommandPermission,
  getUserBlacklist,
  addUserBlacklist,
  removeUserBlacklist,
  getBlacklistedChannels,
  addBlacklistedChannel,
  removeBlacklistedChannel,
  getBlacklistedRoles,
  addBlacklistedRole,
  removeBlacklistedRole,
};

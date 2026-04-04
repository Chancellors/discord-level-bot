const config = require('../config');
const cache = require('../cache/manager');
const queries = require('../database/queries');

/**
 * Check if a user is a bot developer.
 * @param {string} userId
 * @returns {boolean}
 */
function isDev(userId) {
  return config.devIds.includes(userId);
}

/**
 * Check if a user has permission to run a command.
 * Developers always have permission.
 * Otherwise checks command_permissions table for matching command + member roles.
 *
 * @param {string} userId
 * @param {GuildMember} member - Discord.js GuildMember
 * @param {string} guildId
 * @param {string} command - Command name
 * @returns {Promise<boolean>}
 */
async function hasPermission(userId, member, guildId, command) {
  // Devs always have permission
  if (isDev(userId)) return true;

  try {
    const permissions = await queries.getCommandPermissions(guildId);

    // Find permissions for this specific command
    const commandPerms = permissions.filter((p) => p.command === command);

    // If no permissions are set for this command, allow everyone
    if (commandPerms.length === 0) return true;

    // Check if member has any of the required roles
    const memberRoleIds = member.roles.cache.map((r) => r.id);
    return commandPerms.some((perm) => memberRoleIds.includes(perm.role_id));
  } catch (err) {
    console.error(`[Permissions] Error checking permission for ${command}:`, err.message);
    // Fail closed: deny on error
    return false;
  }
}

/**
 * Check if a user is blacklisted from a specific command.
 * @param {string} userId
 * @param {string} guildId
 * @param {string} command - Command name
 * @returns {Promise<boolean>} true if blacklisted
 */
async function checkUserBlacklist(userId, guildId, command) {
  try {
    const blacklist = await queries.getUserBlacklist(guildId);
    return blacklist.some((entry) => entry.user_id === userId && entry.command === command);
  } catch (err) {
    console.error(`[Permissions] Error checking user blacklist:`, err.message);
    return false;
  }
}

/**
 * Check if any of the member's roles are blacklisted.
 * @param {Collection|Array} memberRoles - Role IDs (array or Discord.js Collection)
 * @param {string} guildId
 * @returns {Promise<boolean>} true if has a blacklisted role
 */
async function checkRoleBlacklist(memberRoles, guildId) {
  try {
    const blacklistedRoles = await queries.getBlacklistedRoles(guildId);
    if (blacklistedRoles.length === 0) return false;

    const blacklistedIds = blacklistedRoles.map((r) => r.role_id);

    // Handle both arrays and Discord.js Collections
    const roleIds = Array.isArray(memberRoles)
      ? memberRoles
      : memberRoles.cache
        ? memberRoles.cache.map((r) => r.id)
        : [...memberRoles.values()].map((r) => r.id || r);

    return roleIds.some((id) => blacklistedIds.includes(id));
  } catch (err) {
    console.error(`[Permissions] Error checking role blacklist:`, err.message);
    return false;
  }
}

module.exports = {
  isDev,
  hasPermission,
  checkUserBlacklist,
  checkRoleBlacklist,
};

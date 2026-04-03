const config = require('../config');
const Guild = require('../models/Guild');

/**
 * Dinamik klerans (yetki) kontrolu.
 * Discord yetkisine degil, botun ic delegasyon sistemine bakar.
 *
 * @param {string} userId
 * @param {import('discord.js').GuildMember} member
 * @param {string} guildId
 * @param {string} commandName - kontrol edilecek komut adi
 * @returns {Promise<boolean>}
 */
async function hasPermission(userId, member, guildId, commandName) {
  // Gelistiriciler her zaman yetkili
  if (config.devIds.includes(userId)) return true;

  const guildData = await Guild.findOne({ guildId });
  if (!guildData) return false;

  // commandPermissions icinde komut bazli kontrol
  const perm = guildData.commandPermissions.find(p => p.command === commandName);
  if (!perm) return false;

  // Kullanicinin rollerinden herhangi biri izinli mi?
  const memberRoleIds = member.roles.cache.map(r => r.id);
  return perm.allowedRoles.some(roleId => memberRoleIds.includes(roleId));
}

/**
 * Kategori bazli yetki kontrolu
 */
async function hasCategoryPermission(userId, member, guildId, category) {
  if (config.devIds.includes(userId)) return true;

  const guildData = await Guild.findOne({ guildId });
  if (!guildData) return false;

  const memberRoleIds = member.roles.cache.map(r => r.id);

  // Kategorideki herhangi bir komuta yetkisi var mi?
  return guildData.commandPermissions
    .filter(p => p.category === category)
    .some(p => p.allowedRoles.some(roleId => memberRoleIds.includes(roleId)));
}

/**
 * Gelistirici mi kontrolu
 */
function isDev(userId) {
  return config.devIds.includes(userId);
}

module.exports = { hasPermission, hasCategoryPermission, isDev };

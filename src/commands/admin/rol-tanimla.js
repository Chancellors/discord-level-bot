const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cache = require('../../cache/manager');
const config = require('../../config');
const queries = require('../../database/queries');
const { parseTime, minutesToLevel, formatDuration } = require('../../utils/timeParser');
const { log, LogTier } = require('../../utils/logger');
const { markLegitimate } = require('../../systems/roleGuard');
const { xpForLevel } = require('../../systems/xpEngine');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('rol-tanimla')
    .setDescription('Seviye rolü tanımla.')
    .addRoleOption(opt => opt.setName('rol').setDescription('Tanımlanacak rol').setRequired(true))
    .addStringOption(opt => opt.setName('ses').setDescription('Gereken ses süresi (ör: 1h, 3g, 1a)').setRequired(false))
    .addStringOption(opt => opt.setName('yazi').setDescription('Gereken yazı süresi (ör: 3g, 1h)').setRequired(false))
    .addStringOption(opt =>
      opt.setName('mod')
        .setDescription('Havuz modu')
        .setRequired(false)
        .addChoices(
          { name: 'Ayrı (her hat bağımsız)', value: 'ayri' },
          { name: 'Birleşik (toplam XP)', value: 'birlesik' },
        )),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole('rol');
    const sesStr = interaction.options.getString('ses');
    const yaziStr = interaction.options.getString('yazi');
    const mod = interaction.options.getString('mod') || 'ayri';

    const sesSure = sesStr ? parseTime(sesStr) : 0;
    const yaziSure = yaziStr ? parseTime(yaziStr) : 0;

    if (sesStr && sesSure === null) {
      return interaction.editReply({ content: '❌ Geçersiz ses süresi formatı. Örnek: `1h 3g`, `2a`' });
    }
    if (yaziStr && yaziSure === null) {
      return interaction.editReply({ content: '❌ Geçersiz yazı süresi formatı. Örnek: `1h 3g`, `2a`' });
    }

    const sesLevel = minutesToLevel(sesSure || 0);
    const yaziLevel = minutesToLevel(yaziSure || 0);
    const isStarter = sesLevel === 0 && yaziLevel === 0;

    // Rolu kaydet (initialized = false olarak sifirlanir)
    await queries.addLevelRole(
      interaction.guild.id, role.id, role.name,
      sesSure || 0, yaziSure || 0, sesLevel, yaziLevel, mod,
    );

    markLegitimate(interaction.guild.id, role.id);

    // ─── Ilk Tanimlama: Mevcut rol sahiplerine retroaktif XP ver ────
    let initCount = 0;
    const members = await interaction.guild.members.fetch();
    const roleMembers = members.filter(m => !m.user.bot && m.roles.cache.has(role.id));

    if (roleMembers.size > 0) {
      const sesXP = xpForLevel(sesLevel);
      const yaziXP = xpForLevel(yaziLevel);

      for (const member of roleMembers.values()) {
        try {
          const userData = await cache.getUser(member.id, interaction.guild.id);
          if (!userData) continue;

          let changed = false;

          // Ses XP: sadece mevcut XP yetersizse tamamla
          if (sesXP > 0 && (userData.xp_ses || 0) < sesXP) {
            const needed = sesXP - (userData.xp_ses || 0);
            cache.addUserXP(member.id, interaction.guild.id, 'xp_ses', needed);
            changed = true;
          }

          // Yazi XP: sadece mevcut XP yetersizse tamamla
          if (yaziXP > 0 && (userData.xp_yazi || 0) < yaziXP) {
            const needed = yaziXP - (userData.xp_yazi || 0);
            cache.addUserXP(member.id, interaction.guild.id, 'xp_yazi', needed);
            changed = true;
          }

          if (changed) {
            await cache.flushCritical(member.id, interaction.guild.id);
            initCount++;
          }
        } catch (err) {
          console.error(`[RolTanimla] Retroaktif XP hatasi (${member.id}):`, err.message);
        }
      }
    }

    // initialized olarak isaretle
    await queries.updateLevelRoleInitialized(interaction.guild.id, role.id);

    const embed = new EmbedBuilder()
      .setColor(config.colors.operational)
      .setTitle('✅ Rol Tanımlandı')
      .setDescription(isStarter
        ? `${role} **başlangıç rolü** olarak tanımlandı.`
        : `${role} seviye rolü olarak tanımlandı.`)
      .addFields(
        { name: '🎙️ Ses Süresi', value: sesSure ? formatDuration(sesSure) : 'Yok', inline: true },
        { name: '📝 Yazı Süresi', value: yaziSure ? formatDuration(yaziSure) : 'Yok', inline: true },
        { name: '📊 Mod', value: mod === 'birlesik' ? 'Birleşik' : 'Ayrı', inline: true },
        { name: '🎙️ Ses Seviyesi', value: `${sesLevel}`, inline: true },
        { name: '📝 Yazı Seviyesi', value: `${yaziLevel}`, inline: true },
      )
      .setFooter({ text: 'Evil Mega Corp // Rol Tanımlama' })
      .setTimestamp();

    if (initCount > 0) {
      embed.addFields({
        name: '🔄 Retroaktif XP',
        value: `**${initCount}** mevcut üyeye bu rolün gerektirdiği XP verildi.`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    log(client, interaction.guild.id, LogTier.OPERATIONAL, {
      title: 'Rol Tanımlandı',
      description: `${role.name} seviye rolü tanımlandı.${initCount > 0 ? ` ${initCount} üyeye retroaktif XP verildi.` : ''}`,
      operatorId: interaction.user.id,
      roleId: role.id,
      fields: [
        { name: 'Ses Süresi', value: sesSure ? formatDuration(sesSure) : 'Yok', inline: true },
        { name: 'Yazı Süresi', value: yaziSure ? formatDuration(yaziSure) : 'Yok', inline: true },
        { name: 'Mod', value: mod, inline: true },
      ],
    });
  },
};

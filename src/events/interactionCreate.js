const { log, LogTier } = require('../utils/logger');
const { hasPermission, isDev, checkUserBlacklist, checkRoleBlacklist } = require('../utils/permissions');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Bakim modu
    if (client.maintenanceMode && command.category !== 'dev') {
      return interaction.reply({ content: '🔧 **Evil Mega Corp** şu anda bakım modundadır.', ephemeral: true });
    }

    const guildId = interaction.guild?.id;

    // Kullanici kara listesi
    if (guildId && !isDev(interaction.user.id)) {
      const blacklisted = await checkUserBlacklist(interaction.user.id, guildId, interaction.commandName);
      if (blacklisted) {
        return interaction.reply({ content: '🚫 Bu komutu kullanmanız engellenmiştir.', ephemeral: true });
      }
    }

    // Rol kara listesi (user komutlari icin)
    if (guildId && command.category === 'user') {
      const memberRoles = interaction.member?.roles?.cache?.map(r => r.id) || [];
      const roleBlocked = await checkRoleBlacklist(memberRoles, guildId);
      if (roleBlocked) {
        return interaction.reply({ content: '🚫 Sahip olduğunuz bir rol nedeniyle bu komutu kullanamazsınız.', ephemeral: true });
      }
    }

    // Admin yetki kontrolu
    if (command.category === 'admin') {
      const allowed = await hasPermission(interaction.user.id, interaction.member, guildId, interaction.commandName);
      if (!allowed) {
        await log(client, guildId, LogTier.SECURITY, {
          title: 'Erişim Engeli',
          operatorId: interaction.user.id,
          fields: [{ name: 'Komut', value: `/${interaction.commandName}`, inline: true }],
        });
        return interaction.reply({ content: '🚫 Bu komutu kullanma yetkiniz bulunmamaktadır.', ephemeral: true });
      }
    }

    // Dev kontrolu
    if (command.category === 'dev' && !isDev(interaction.user.id)) {
      return interaction.reply({ content: '👁️ Bu komut Shadow Authority yetkisi gerektirir.', ephemeral: true });
    }

    try {
      await command.execute(interaction, client);

      if (command.category === 'admin' && !client.ghostMode.has(interaction.user.id)) {
        await log(client, guildId, LogTier.OPERATIONAL, {
          title: 'Komut Kullanımı',
          operatorId: interaction.user.id,
          fields: [{ name: 'Komut', value: `/${interaction.commandName}`, inline: true }],
        });
      }
    } catch (err) {
      console.error(`[Command] /${interaction.commandName} hatasi:`, err);
      const reply = { content: '❌ Komut çalıştırılırken bir hata oluştu.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};

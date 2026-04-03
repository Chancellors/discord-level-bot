const { log, LogTier } = require('../utils/logger');
const { hasPermission, isDev } = require('../utils/permissions');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Bakim modu kontrolu - sadece dev komutlari gecebilir
    if (client.maintenanceMode && command.category !== 'dev') {
      return interaction.reply({
        content: '🔧 **Evil Mega Corp** şu anda bakım modundadır. Lütfen daha sonra deneyin.',
        ephemeral: true,
      });
    }

    // Yetki kontrolu (admin komutlari icin)
    if (command.category === 'admin') {
      const allowed = await hasPermission(
        interaction.user.id,
        interaction.member,
        interaction.guild.id,
        interaction.commandName
      );
      if (!allowed) {
        // Erisim engeli logu
        await log(client, interaction.guild.id, LogTier.SECURITY, {
          title: 'Erişim Engeli',
          description: `Yetkisiz komut denemesi reddedildi.`,
          operatorId: interaction.user.id,
          channelId: interaction.channel.id,
          fields: [
            { name: 'Komut', value: `/${interaction.commandName}`, inline: true },
          ],
        });

        return interaction.reply({
          content: '🚫 Bu komutu kullanma yetkiniz bulunmamaktadır. Yetki almak için üst yönetiminize başvurun.',
          ephemeral: true,
        });
      }
    }

    // Dev komutu kontrolu
    if (command.category === 'dev' && !isDev(interaction.user.id)) {
      return interaction.reply({
        content: '👁️ Bu komut Shadow Authority yetkisi gerektirir.',
        ephemeral: true,
      });
    }

    try {
      await command.execute(interaction, client);

      // Operasyonel log (admin komutlari icin, ghost modda degilse)
      if (command.category === 'admin' && !client.ghostMode.has(interaction.user.id)) {
        await log(client, interaction.guild.id, LogTier.OPERATIONAL, {
          title: 'Komut Kullanımı',
          description: `Admin komutu çalıştırıldı.`,
          operatorId: interaction.user.id,
          channelId: interaction.channel.id,
          fields: [
            { name: 'Komut', value: `/${interaction.commandName}`, inline: true },
            {
              name: 'Parametreler',
              value: interaction.options.data.map(o => `${o.name}: ${o.value}`).join(', ') || 'Yok',
              inline: false,
            },
          ],
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

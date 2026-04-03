const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../../models/Guild');
const { log, LogTier } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('yetki')
    .setDescription('Dinamik yetki delegasyonu sistemi.')
    .addSubcommand(sub =>
      sub.setName('ata-komut')
        .setDescription('Bir role belirli bir komutu kullanma yetkisi ver.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Yetki verilecek rol').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı (ör: kullanici-yonet)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ata-kategori')
        .setDescription('Bir role tüm admin komutlarını kullanma yetkisi ver.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Yetki verilecek rol').setRequired(true))
        .addStringOption(opt =>
          opt.setName('kategori')
            .setDescription('Kategori')
            .setRequired(true)
            .addChoices({ name: 'Admin', value: 'admin' })
        )
    )
    .addSubcommand(sub =>
      sub.setName('geri-al')
        .setDescription('Bir rolden komut yetkisini geri al.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('rapor')
        .setDescription('Mevcut yetki delegasyonlarını göster.')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

    if (sub === 'ata-komut') {
      const rol = interaction.options.getRole('rol');
      const komut = interaction.options.getString('komut');

      // Komutun var olup olmadigini kontrol et
      if (!client.commands.has(komut)) {
        return interaction.reply({ content: `❌ \`/${komut}\` adında bir komut bulunamadı.`, ephemeral: true });
      }

      let perm = guildData.commandPermissions.find(p => p.command === komut);
      if (!perm) {
        guildData.commandPermissions.push({ command: komut, category: 'admin', allowedRoles: [rol.id] });
      } else if (!perm.allowedRoles.includes(rol.id)) {
        perm.allowedRoles.push(rol.id);
      } else {
        return interaction.reply({ content: `ℹ️ ${rol} zaten \`/${komut}\` yetkisine sahip.`, ephemeral: true });
      }

      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Yetki Devri: Komut Atandı',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [{ name: 'Komut', value: `/${komut}`, inline: true }],
      });

      return interaction.reply({ content: `✅ ${rol} artık \`/${komut}\` komutunu kullanabilir.`, ephemeral: true });
    }

    if (sub === 'ata-kategori') {
      const rol = interaction.options.getRole('rol');
      const kategori = interaction.options.getString('kategori');

      const adminCommands = client.commands.filter(c => c.category === kategori);

      for (const [name] of adminCommands) {
        let perm = guildData.commandPermissions.find(p => p.command === name);
        if (!perm) {
          guildData.commandPermissions.push({ command: name, category: kategori, allowedRoles: [rol.id] });
        } else if (!perm.allowedRoles.includes(rol.id)) {
          perm.allowedRoles.push(rol.id);
        }
      }

      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Yetki Devri: Kategori Atandı',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [
          { name: 'Kategori', value: kategori, inline: true },
          { name: 'Komut Sayısı', value: `${adminCommands.size}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ ${rol} artık tüm **${kategori}** komutlarını (${adminCommands.size} adet) kullanabilir.`, ephemeral: true });
    }

    if (sub === 'geri-al') {
      const rol = interaction.options.getRole('rol');
      const komut = interaction.options.getString('komut');

      const perm = guildData.commandPermissions.find(p => p.command === komut);
      if (!perm || !perm.allowedRoles.includes(rol.id)) {
        return interaction.reply({ content: `ℹ️ ${rol} zaten \`/${komut}\` yetkisine sahip değil.`, ephemeral: true });
      }

      perm.allowedRoles = perm.allowedRoles.filter(r => r !== rol.id);
      if (perm.allowedRoles.length === 0) {
        guildData.commandPermissions = guildData.commandPermissions.filter(p => p.command !== komut);
      }

      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Yetki Devri: Geri Alındı',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [{ name: 'Komut', value: `/${komut}`, inline: true }],
      });

      return interaction.reply({ content: `✅ ${rol} artık \`/${komut}\` komutunu kullanamaz.`, ephemeral: true });
    }

    if (sub === 'rapor') {
      if (!guildData.commandPermissions.length) {
        return interaction.reply({ content: '📋 Henüz yetki delegasyonu yapılmamış.', ephemeral: true });
      }

      const lines = guildData.commandPermissions.map(p => {
        const roles = p.allowedRoles.map(r => `<@&${r}>`).join(', ');
        return `\`/${p.command}\` → ${roles}`;
      });

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📊 Evil Mega Corp // Yetki Delegasyon Raporu')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

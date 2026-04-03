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
      sub.setName('geri-al-kategori')
        .setDescription('Bir rolden tüm kategori yetkilerini geri al.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true))
        .addStringOption(opt =>
          opt.setName('kategori')
            .setDescription('Kategori')
            .setRequired(true)
            .addChoices({ name: 'Admin', value: 'admin' })
        )
    )
    .addSubcommand(sub =>
      sub.setName('kara-liste')
        .setDescription('Bir kullanıcının belirli bir komutu kullanmasını engelle.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Engellenecek kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Engellenecek komut adı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('kara-liste-kaldir')
        .setDescription('Bir kullanıcının komut engelini kaldır.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('gecici')
        .setDescription('Bir role geçici süre ile komut yetkisi ver.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Yetki verilecek rol').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true))
        .addIntegerOption(opt => opt.setName('sure').setDescription('Süre (dakika)').setRequired(true).setMinValue(1).setMaxValue(10080))
    )
    .addSubcommand(sub =>
      sub.setName('rapor')
        .setDescription('Mevcut yetki delegasyonlarını ve kara listeyi göster.')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    let guildData = await Guild.findOne({ guildId });
    if (!guildData) guildData = await Guild.create({ guildId });

    if (sub === 'ata-komut') {
      const rol = interaction.options.getRole('rol');
      const komut = interaction.options.getString('komut');

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

    if (sub === 'geri-al-kategori') {
      const rol = interaction.options.getRole('rol');
      const kategori = interaction.options.getString('kategori');
      let removedCount = 0;

      for (const perm of guildData.commandPermissions) {
        if (perm.category === kategori && perm.allowedRoles.includes(rol.id)) {
          perm.allowedRoles = perm.allowedRoles.filter(r => r !== rol.id);
          removedCount++;
        }
      }

      // Bos kalan izinleri temizle
      guildData.commandPermissions = guildData.commandPermissions.filter(p => p.allowedRoles.length > 0);
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Yetki Devri: Kategori Geri Alındı',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [
          { name: 'Kategori', value: kategori, inline: true },
          { name: 'Kaldırılan Yetki', value: `${removedCount}`, inline: true },
        ],
      });

      return interaction.reply({ content: `✅ ${rol} artık **${kategori}** kategorisindeki ${removedCount} komutu kullanamaz.`, ephemeral: true });
    }

    if (sub === 'kara-liste') {
      const kullanici = interaction.options.getUser('kullanici');
      const komut = interaction.options.getString('komut');

      const exists = guildData.userCommandBlacklist.find(b => b.userId === kullanici.id && b.command === komut);
      if (exists) {
        return interaction.reply({ content: `ℹ️ ${kullanici} zaten \`/${komut}\` kara listesinde.`, ephemeral: true });
      }

      guildData.userCommandBlacklist.push({ userId: kullanici.id, command: komut });
      await guildData.save();

      await log(interaction.client, guildId, LogTier.SECURITY, {
        title: 'Kullanıcı Kara Listesi: Eklendi',
        operatorId: interaction.user.id,
        targetId: kullanici.id,
        fields: [{ name: 'Engellenen Komut', value: `/${komut}`, inline: true }],
      });

      return interaction.reply({ content: `🚫 ${kullanici} artık \`/${komut}\` komutunu kullanamaz.`, ephemeral: true });
    }

    if (sub === 'kara-liste-kaldir') {
      const kullanici = interaction.options.getUser('kullanici');
      const komut = interaction.options.getString('komut');

      const index = guildData.userCommandBlacklist.findIndex(b => b.userId === kullanici.id && b.command === komut);
      if (index === -1) {
        return interaction.reply({ content: `ℹ️ ${kullanici} \`/${komut}\` kara listesinde değil.`, ephemeral: true });
      }

      guildData.userCommandBlacklist.splice(index, 1);
      await guildData.save();

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Kullanıcı Kara Listesi: Kaldırıldı',
        operatorId: interaction.user.id,
        targetId: kullanici.id,
        fields: [{ name: 'Komut', value: `/${komut}`, inline: true }],
      });

      return interaction.reply({ content: `✅ ${kullanici} artık \`/${komut}\` komutunu tekrar kullanabilir.`, ephemeral: true });
    }

    if (sub === 'gecici') {
      const rol = interaction.options.getRole('rol');
      const komut = interaction.options.getString('komut');
      const sure = interaction.options.getInteger('sure');

      if (!client.commands.has(komut)) {
        return interaction.reply({ content: `❌ \`/${komut}\` adında bir komut bulunamadı.`, ephemeral: true });
      }

      let perm = guildData.commandPermissions.find(p => p.command === komut);
      if (!perm) {
        guildData.commandPermissions.push({ command: komut, category: 'admin', allowedRoles: [rol.id] });
      } else if (!perm.allowedRoles.includes(rol.id)) {
        perm.allowedRoles.push(rol.id);
      }

      await guildData.save();

      // Zamanlayici: sure dolunca otomatik geri al
      setTimeout(async () => {
        try {
          const freshGuild = await Guild.findOne({ guildId });
          if (!freshGuild) return;
          const freshPerm = freshGuild.commandPermissions.find(p => p.command === komut);
          if (freshPerm) {
            freshPerm.allowedRoles = freshPerm.allowedRoles.filter(r => r !== rol.id);
            if (freshPerm.allowedRoles.length === 0) {
              freshGuild.commandPermissions = freshGuild.commandPermissions.filter(p => p.command !== komut);
            }
            await freshGuild.save();
          }

          await log(client, guildId, LogTier.OPERATIONAL, {
            title: 'Geçici Yetki Süresi Doldu',
            description: `${rol.name} rolünün \`/${komut}\` yetkisi otomatik olarak geri alındı.`,
            operatorId: 'SYSTEM',
            roleId: rol.id,
          });
        } catch (err) {
          console.error('[TempPerm] Zamanlayıcı hatası:', err.message);
        }
      }, sure * 60 * 1000);

      const bitisSuresi = new Date(Date.now() + sure * 60 * 1000);
      const timestamp = Math.floor(bitisSuresi.getTime() / 1000);

      await log(interaction.client, guildId, LogTier.OPERATIONAL, {
        title: 'Geçici Yetki Devri',
        operatorId: interaction.user.id,
        roleId: rol.id,
        fields: [
          { name: 'Komut', value: `/${komut}`, inline: true },
          { name: 'Süre', value: `${sure} dakika`, inline: true },
        ],
      });

      return interaction.reply({
        content: `✅ ${rol} → \`/${komut}\` yetkisi **${sure} dakika** süreyle verildi.\n⏰ Bitiş: <t:${timestamp}:R>`,
        ephemeral: true,
      });
    }

    if (sub === 'rapor') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📊 Evil Mega Corp // Yetki Delegasyon Raporu')
        .setFooter({ text: 'Evil Mega Corp // Admin Panel' })
        .setTimestamp();

      // Komut yetkileri
      if (guildData.commandPermissions.length) {
        const lines = guildData.commandPermissions.map(p => {
          const roles = p.allowedRoles.map(r => `<@&${r}>`).join(', ');
          return `\`/${p.command}\` → ${roles}`;
        });
        embed.addFields({
          name: `🔑 Komut Yetkileri (${guildData.commandPermissions.length})`,
          value: lines.join('\n'),
          inline: false,
        });
      } else {
        embed.addFields({
          name: '🔑 Komut Yetkileri',
          value: 'Henüz yetki delegasyonu yapılmamış.',
          inline: false,
        });
      }

      // Kullanici kara listesi
      if (guildData.userCommandBlacklist.length) {
        const blacklistLines = guildData.userCommandBlacklist.map(b => {
          return `<@${b.userId}> → \`/${b.command}\` 🚫`;
        });
        embed.addFields({
          name: `🚫 Kullanıcı Kara Listesi (${guildData.userCommandBlacklist.length})`,
          value: blacklistLines.join('\n'),
          inline: false,
        });
      } else {
        embed.addFields({
          name: '🚫 Kullanıcı Kara Listesi',
          value: 'Kara listede kullanıcı yok.',
          inline: false,
        });
      }

      // Ozet
      const totalPerms = guildData.commandPermissions.reduce((acc, p) => acc + p.allowedRoles.length, 0);
      embed.addFields({
        name: '📈 Özet',
        value: [
          `**Toplam Yetki:** ${totalPerms} rol-komut eşleşmesi`,
          `**Kara Liste:** ${guildData.userCommandBlacklist.length} engel`,
        ].join('\n'),
        inline: false,
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

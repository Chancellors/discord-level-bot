const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');
const queries = require('../../database/queries');
const { log, LogTier } = require('../../utils/logger');

module.exports = {
  category: 'admin',
  data: new SlashCommandBuilder()
    .setName('yetki')
    .setDescription('Yetki ve engel yönetimi.')
    .addSubcommand(sub =>
      sub.setName('ver')
        .setDescription('Bir role admin komut yetkisi ver.')
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true))
        .addRoleOption(opt => opt.setName('rol').setDescription('Yetki verilecek rol').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('al')
        .setDescription('Bir rolden admin komut yetkisini al.')
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true))
        .addRoleOption(opt => opt.setName('rol').setDescription('Yetkisi alınacak rol').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('kullanici-engelle')
        .setDescription('Kullanıcıyı bir komuttan engelle.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Engellenecek kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('kullanici-serbest')
        .setDescription('Kullanıcının komut engelini kaldır.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('komut').setDescription('Komut adı').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('kanal-engelle')
        .setDescription('Bir kanalda XP kazanmayı engelle.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Engellenecek kanal').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)))
    .addSubcommand(sub =>
      sub.setName('kanal-serbest')
        .setDescription('Kanal XP engelini kaldır.')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Kanal').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)))
    .addSubcommand(sub =>
      sub.setName('rol-engelle')
        .setDescription('Bir rolü XP kazanmaktan engelle.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Engellenecek rol').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('rol-serbest')
        .setDescription('Rol XP engelini kaldır.')
        .addRoleOption(opt => opt.setName('rol').setDescription('Rol').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('liste')
        .setDescription('Tüm yetki ve engel listesini göster.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'ver') {
      const komut = interaction.options.getString('komut');
      const rol = interaction.options.getRole('rol');
      await queries.addCommandPermission(guildId, komut, 'admin', rol.id);
      await interaction.reply({ content: `✅ **${rol.name}** rolüne \`/${komut}\` komutu yetkisi verildi.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Komut Yetkisi Verildi',
        description: `${rol.name} → /${komut}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'al') {
      const komut = interaction.options.getString('komut');
      const rol = interaction.options.getRole('rol');
      await queries.removeCommandPermission(guildId, komut, rol.id);
      await interaction.reply({ content: `✅ **${rol.name}** rolünden \`/${komut}\` komutu yetkisi alındı.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Komut Yetkisi Alındı',
        description: `${rol.name} ← /${komut}`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'kullanici-engelle') {
      const kullanici = interaction.options.getUser('kullanici');
      const komut = interaction.options.getString('komut');
      await queries.addUserBlacklist(guildId, kullanici.id, komut);
      await interaction.reply({ content: `✅ **${kullanici.username}** \`/${komut}\` komutundan engellendi.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Kullanıcı Komut Engeli',
        description: `${kullanici.username} ← /${komut} engellendi.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'kullanici-serbest') {
      const kullanici = interaction.options.getUser('kullanici');
      const komut = interaction.options.getString('komut');
      await queries.removeUserBlacklist(guildId, kullanici.id, komut);
      await interaction.reply({ content: `✅ **${kullanici.username}** \`/${komut}\` komut engeli kaldırıldı.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Kullanıcı Komut Engeli Kaldırıldı',
        description: `${kullanici.username} → /${komut} serbest.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'kanal-engelle') {
      const kanal = interaction.options.getChannel('kanal');
      await queries.addBlacklistedChannel(guildId, kanal.id);
      await interaction.reply({ content: `✅ ${kanal} kanalında XP kazanma engellendi.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Kanal XP Engeli',
        description: `${kanal.name} XP engellendi.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'kanal-serbest') {
      const kanal = interaction.options.getChannel('kanal');
      await queries.removeBlacklistedChannel(guildId, kanal.id);
      await interaction.reply({ content: `✅ ${kanal} kanalı XP engelinden çıkarıldı.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Kanal XP Engeli Kaldırıldı',
        description: `${kanal.name} XP serbest.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'rol-engelle') {
      const rol = interaction.options.getRole('rol');
      await queries.addBlacklistedRole(guildId, rol.id);
      await interaction.reply({ content: `✅ **${rol.name}** rolü XP kazanmaktan engellendi.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Rol XP Engeli',
        description: `${rol.name} XP engellendi.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'rol-serbest') {
      const rol = interaction.options.getRole('rol');
      await queries.removeBlacklistedRole(guildId, rol.id);
      await interaction.reply({ content: `✅ **${rol.name}** rolü XP engelinden çıkarıldı.`, ephemeral: true });

      log(client, guildId, LogTier.SECURITY, {
        title: 'Rol XP Engeli Kaldırıldı',
        description: `${rol.name} XP serbest.`,
        operatorId: interaction.user.id,
      });
      return;
    }

    if (sub === 'liste') {
      const [perms, userBl, channelBl, roleBl] = await Promise.all([
        queries.getCommandPermissions(guildId),
        queries.getUserBlacklist(guildId),
        queries.getBlacklistedChannels(guildId),
        queries.getBlacklistedRoles(guildId),
      ]);

      const permLines = perms && perms.length > 0
        ? perms.map(p => `\`/${p.command}\` → <@&${p.role_id}>`).join('\n')
        : 'Tanımlı yetki yok';

      const userBlLines = userBl && userBl.length > 0
        ? userBl.map(b => `<@${b.user_id}> ← \`/${b.command}\``).join('\n')
        : 'Engelli kullanıcı yok';

      const channelBlLines = channelBl && channelBl.length > 0
        ? channelBl.map(b => `<#${b.channel_id}>`).join(', ')
        : 'Engelli kanal yok';

      const roleBlLines = roleBl && roleBl.length > 0
        ? roleBl.map(b => `<@&${b.role_id}>`).join(', ')
        : 'Engelli rol yok';

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🔐 Evil Mega Corp // Yetki & Engel Listesi')
        .addFields(
          { name: '🔑 Komut Yetkileri', value: permLines, inline: false },
          { name: '🚫 Engelli Kullanıcılar', value: userBlLines, inline: false },
          { name: '📵 Engelli Kanallar', value: channelBlLines, inline: false },
          { name: '🏷️ Engelli Roller', value: roleBlLines, inline: false },
        )
        .setFooter({ text: 'Evil Mega Corp // Yetkiler' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

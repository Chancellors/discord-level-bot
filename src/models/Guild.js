const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },

  // Kanal ayarlari
  logChannel: { type: String, default: null },
  notificationChannel: { type: String, default: null },

  // Seviye rolleri - Ayri hiyerarsiler
  levelRolesText: [{
    level: { type: Number, required: true },
    roleId: { type: String, required: true },
    name: { type: String, default: '' },
  }],
  levelRolesVoice: [{
    level: { type: Number, required: true },
    roleId: { type: String, required: true },
    name: { type: String, default: '' },
  }],

  // Baslangic rolleri
  startingRoles: [{ type: String }],

  // Kara liste - XP kazanamayacak kanallar
  blacklistedChannels: [{ type: String }],

  // XP etkinlik carpani
  xpMultiplier: { type: Number, default: 1.0 },

  // Bildirim mesaj sablonlari
  notificationTemplateText: {
    type: String,
    default: '📊 **Evil Mega Corp** // Üye / Prestij – Yazı Hattı Güncellemesi\n{user}, **{oldLevel}** ({oldRole}) seviyesinden **{newLevel}** ({newRole}) seviyesine yükseltildi.',
  },
  notificationTemplateVoice: {
    type: String,
    default: '📊 **Evil Mega Corp** // Üye / Prestij – Ses Hattı Güncellemesi\n{user}, **{oldLevel}** ({oldRole}) seviyesinden **{newLevel}** ({newRole}) seviyesine yükseltildi.',
  },

  // Bakim modu
  maintenanceMode: { type: Boolean, default: false },

  // Dinamik yetki delegasyonu
  commandPermissions: [{
    command: { type: String, required: true },
    category: { type: String, default: 'admin' },
    allowedRoles: [{ type: String }],
  }],

  // Ses kosullari - seviye bazli izinler
  voiceConditions: {
    muteAllowedLevel: { type: Number, default: 0 },
    deafenAllowedLevel: { type: Number, default: 0 },
    soloXpLevel: { type: Number, default: 0 },
  },

  // Anti-spam ayarlari
  antiSpam: {
    enabled: { type: Boolean, default: true },
    maxMessagesPerMinute: { type: Number, default: 15 },
    voiceHopLimit: { type: Number, default: 5 },
    voiceHopWindow: { type: Number, default: 60_000 },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Guild', guildSchema);

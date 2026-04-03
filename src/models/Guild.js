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

  // Bildirim sistemi acik/kapali
  notificationsEnabled: { type: Boolean, default: true },

  // XP kazanmayan roller
  blacklistedRoles: [{ type: String }],

  // Ses kosullari - seviye bazli izinler
  voiceConditions: {
    muteAllowedLevel: { type: Number, default: 0 },
    deafenAllowedLevel: { type: Number, default: 0 },
    soloXpLevel: { type: Number, default: 0 },
    afkXpAllowed: { type: Boolean, default: false },
    minUsersForXp: { type: Number, default: 2 },
  },

  // Anti-spam ayarlari
  antiSpam: {
    enabled: { type: Boolean, default: true },
    maxMessagesPerMinute: { type: Number, default: 15 },
    voiceHopLimit: { type: Number, default: 5 },
    voiceHopWindow: { type: Number, default: 60_000 },
  },

  // Yetki kara listesi - belirli kullanicilarin belirli komutlara erisimini engeller
  userCommandBlacklist: [{
    userId: { type: String, required: true },
    command: { type: String, required: true },
  }],

  // --- Karsilayici Sistemi ---
  welcomeEnabled: { type: Boolean, default: false },
  welcomeChannel: { type: String, default: null },
  welcomeMessage: {
    type: String,
    default: `**:wave: Merhaba [user], Evil Mega Corp'a hoş geldin!**
Burası **[server]** oyun ve topluluk sunucusu.
Şu an topluluğumuz **[memberCount]** üyeden oluşuyor.

*:black_joker: Sunucuda rol sistemi kullanıyoruz:*

**:crown: Admin / Yönetim (High Deck):**
*Deck Sovereign, Arcane Crown, Void Emperor, Eclipse Judge, Veil Warden*

**:shield: Mod / Gözetmen (Court Deck):**
*Solar Herald, Lunar Herald, Gate Warden, Card Sentinel, Spread Marshal*

**:flower_playing_cards: Üye / Prestij (Living Cards):**
*Toplam 10 seviye üye rolü bulunuyor.*

*Sunucuya katıldığında **"Blank Sigil"** rolüyle başlıyorsun.*
*:speech_balloon: Discord'da sohbet ederek, :headphones: ses kanallarında vakit geçirerek ve :date: etkinliklere katılarak diğer üye rollerine (**First Draw, Minor Omen, Fatebound, Deck Disciple, Arcane Adept, Card Knight, Soul Reader, Inner Oracle, Living Major**) yükselebilirsin.*

:unlock: Mührün ve Prestij kaydın arttıkça daha fazla yetki, özel kanallar ve çeşitli avantajlar açılacak.

:question: **Herhangi bir sorunda yetkililere yazman yeterli.**
:video_game: **İyi eğlenceler!**`,
  },
  welcomeSendDM: { type: Boolean, default: false }, // DM olarak mi kanala mi

  leaveEnabled: { type: Boolean, default: false },
  leaveChannel: { type: String, default: null }, // ayri kanal (log kanali vb.)
  leaveMessage: {
    type: String,
    default: "[server]'dan [user]([userName]) ayrıldı",
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Guild', guildSchema);

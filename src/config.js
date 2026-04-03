module.exports = {
  devIds: process.env.DEV_IDS?.split(',').map(id => id.trim()) || [],
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/evil-mega-corp',
  clientId: process.env.CLIENT_ID,
  token: process.env.DISCORD_TOKEN,

  // XP formula: 5 * (level^2) + 50 * level + 100
  xpFormula: (level) => 5 * (level ** 2) + 50 * level + 100,

  // XP kazanim ayarlari
  xp: {
    textMin: 15,
    textMax: 25,
    textCooldown: 60_000, // 60 saniye
    voicePerMinute: 10,
    voiceInterval: 60_000, // 60 saniye
  },

  // Vergi sistemi - AFK/pasiflik cezasi
  tax: {
    afkPenaltyPerMinute: 2,
    mutePenaltyMultiplier: 0.5, // mute iken XP carpani
    deafPenaltyMultiplier: 0,   // deafen iken XP yok
  },

  // Embed renkleri
  colors: {
    success: 0x00ff00,
    info: 0x3498db,
    warning: 0xf39c12,
    error: 0xe74c3c,
    critical: 0xff0000,
    shadow: 0x9b59b6,
    prestige: 0xffd700,
  },
};

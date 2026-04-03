const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },

  // Yazi Hatti
  xpText: { type: Number, default: 0 },
  levelText: { type: Number, default: 0 },
  totalMessagesText: { type: Number, default: 0 },

  // Ses Hatti
  xpVoice: { type: Number, default: 0 },
  levelVoice: { type: Number, default: 0 },
  totalMinutesVoice: { type: Number, default: 0 },

  // Rol yedekleri - Self-Healing icin
  roles: [{ type: String }],

  // Prestij gecmisi
  prestigeHistory: [{
    type: { type: String, enum: ['text', 'voice'] },
    oldLevel: Number,
    newLevel: Number,
    oldRole: String,
    newRole: String,
    timestamp: { type: Date, default: Date.now },
  }],

  // Yaptirmlar
  frozen: { type: Boolean, default: false },
  frozenBy: { type: String, default: null },
  frozenAt: { type: Date, default: null },

  // Sicil kayitlari
  records: [{
    action: String,
    reason: String,
    operatorId: String,
    timestamp: { type: Date, default: Date.now },
  }],

  // Vergi/ceza kayitlari
  taxHistory: [{
    amount: Number,
    reason: String,
    timestamp: { type: Date, default: Date.now },
  }],

  // Kart ayarlari
  cardTheme: { type: String, default: 'default' },
  cardColor: { type: String, default: '#ffffff' },
  unlockedThemes: [{ type: String }],
}, {
  timestamps: true,
});

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });
userSchema.index({ guildId: 1, xpText: -1 });
userSchema.index({ guildId: 1, xpVoice: -1 });

module.exports = mongoose.model('User', userSchema);

const config = {
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  devIds: (process.env.DEV_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'evil_mega_corp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  timezoneOffset: parseInt(process.env.TIMEZONE_OFFSET, 10) || 3,

  xp: {
    voicePerMinute: 15,
    textPerWord: 5,
    perLevel: 100,
  },

  nightHours: {
    start: 0,
    end: 8,
  },

  nightMultiplier: 2,
  streamMultiplier: 1.2,
  passiveMultiplier: 0.5,

  colors: {
    personnel: '#2ecc71',
    operational: '#f39c12',
    security: '#e74c3c',
    shadow: '#9b59b6',
    prestige: '#e91e63',
    info: '#3498db',
  },

  isNightTime() {
    const now = new Date();
    const localHour = (now.getUTCHours() + config.timezoneOffset + 24) % 24;
    return localHour >= config.nightHours.start && localHour < config.nightHours.end;
  },
};

module.exports = config;

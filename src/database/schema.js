const { query } = require('./pool');

const DEFAULT_WELCOME_MESSAGE = `Hosgeldin [user]! [server] sunucusuna katildin.

Burada sesli ve yazili kanallarda aktif olarak seviye kazanabilir, ozel roller acabilirsin.

Iyi eglenceler ve basarilar dileriz!`;

const DEFAULT_LEAVE_MESSAGE = "[server]'dan [user]([userName]) ayrildi";

async function initializeDatabase() {
  console.log('[DB] Veritabani tablolari kontrol ediliyor...');

  await query(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id VARCHAR(20) PRIMARY KEY,
      log_channel VARCHAR(20),
      notification_channel VARCHAR(20),
      welcome_enabled BOOLEAN DEFAULT false,
      welcome_channel VARCHAR(20),
      welcome_message TEXT DEFAULT $1,
      welcome_send_dm BOOLEAN DEFAULT false,
      leave_enabled BOOLEAN DEFAULT false,
      leave_channel VARCHAR(20),
      leave_message TEXT DEFAULT $2,
      notifications_enabled BOOLEAN DEFAULT true,
      notification_template_text TEXT,
      notification_template_voice TEXT,
      etkinlik_carpani REAL DEFAULT 1.0,
      etkinlik_bitisi TIMESTAMPTZ,
      maintenance_mode BOOLEAN DEFAULT false,
      anti_spam_enabled BOOLEAN DEFAULT true,
      anti_spam_max_messages INTEGER DEFAULT 15,
      anti_spam_voice_hop_limit INTEGER DEFAULT 5,
      voice_mute_allowed_level INTEGER DEFAULT 0,
      voice_deafen_allowed_level INTEGER DEFAULT 0,
      voice_afk_xp_allowed BOOLEAN DEFAULT false,
      voice_min_users INTEGER DEFAULT 2,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `, [DEFAULT_WELCOME_MESSAGE, DEFAULT_LEAVE_MESSAGE]);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      xp_ses INTEGER DEFAULT 0,
      xp_yazi INTEGER DEFAULT 0,
      level_ses INTEGER DEFAULT 0,
      level_yazi INTEGER DEFAULT 0,
      total_minutes_voice INTEGER DEFAULT 0,
      total_words_text INTEGER DEFAULT 0,
      roles JSONB DEFAULT '[]',
      last_known_roles JSONB DEFAULT '[]',
      left_at TIMESTAMPTZ,
      leave_count INTEGER DEFAULT 0,
      last_leave_reason VARCHAR(10),
      askida BOOLEAN DEFAULT false,
      askiya_alan VARCHAR(20),
      askiya_tarihi TIMESTAMPTZ,
      askiya_bitis TIMESTAMPTZ,
      card_theme VARCHAR(20) DEFAULT 'default',
      card_color VARCHAR(7) DEFAULT '#ffffff',
      unlocked_themes JSONB DEFAULT '[]',
      dm_notifications BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, guild_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS level_roles (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      role_id VARCHAR(20) NOT NULL,
      role_name VARCHAR(100),
      ses_sure INTEGER,
      yazi_sure INTEGER,
      ses_level INTEGER,
      yazi_level INTEGER,
      mod VARCHAR(10) DEFAULT 'ayri',
      initialized BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(guild_id, role_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS kariyer_sicili (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      eski_rol VARCHAR(100),
      yeni_rol VARCHAR(100),
      eski_level INTEGER,
      yeni_level INTEGER,
      hat VARCHAR(10),
      gecen_sure_gun INTEGER,
      toplam_aktif_dakika INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(20) NOT NULL,
      guild_id VARCHAR(20) NOT NULL,
      action VARCHAR(50) NOT NULL,
      reason TEXT,
      operator_id VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS command_permissions (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      command VARCHAR(50) NOT NULL,
      category VARCHAR(20) DEFAULT 'admin',
      role_id VARCHAR(20) NOT NULL,
      UNIQUE(guild_id, command, role_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_command_blacklist (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      user_id VARCHAR(20) NOT NULL,
      command VARCHAR(50) NOT NULL,
      UNIQUE(guild_id, user_id, command)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS blacklisted_channels (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      channel_id VARCHAR(20) NOT NULL,
      UNIQUE(guild_id, channel_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS blacklisted_roles (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      role_id VARCHAR(20) NOT NULL,
      UNIQUE(guild_id, role_id)
    )
  `);

  // Indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_users_guild_id ON users(guild_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_guild_xp_ses ON users(guild_id, xp_ses DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_users_guild_xp_yazi ON users(guild_id, xp_yazi DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_level_roles_guild_id ON level_roles(guild_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kariyer_sicili_guild_user ON kariyer_sicili(guild_id, user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_records_guild_user ON records(guild_id, user_id)`);

  console.log('[DB] Tum tablolar ve indexler hazir.');
}

module.exports = { initializeDatabase };

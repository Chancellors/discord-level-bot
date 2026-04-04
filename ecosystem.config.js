require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'evil-mega-corp',
      script: 'src/index.js',
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        BOT_TOKEN: process.env.BOT_TOKEN,
        CLIENT_ID: process.env.CLIENT_ID,
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DEV_IDS: process.env.DEV_IDS,
        TIMEZONE_OFFSET: process.env.TIMEZONE_OFFSET,
      },
    },
  ],
};

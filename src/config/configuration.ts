export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME ?? 'isp',
  },

  wisphub: {
    apiUrl: process.env.WISPHUB_API_URL ?? 'https://api.wisphub.net/api',
    apiKey: process.env.WISPHUB_API_KEY,
  },

  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL ?? 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY,
    instanceName: process.env.EVOLUTION_INSTANCE_NAME ?? 'isp',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  notifications: {
    batchSize: parseInt(process.env.BATCH_SIZE ?? '20', 10),
    delayMinMs: parseInt(process.env.DELAY_MIN_MS ?? '15000', 10),
    delayMaxMs: parseInt(process.env.DELAY_MAX_MS ?? '45000', 10),
    batchPauseMinMs: parseInt(process.env.BATCH_PAUSE_MIN_MS ?? '180000', 10),
    batchPauseMaxMs: parseInt(process.env.BATCH_PAUSE_MAX_MS ?? '300000', 10),
    cronMorning: process.env.CRON_MORNING ?? '0 9 * * 1-6',
    cronAfternoon: process.env.CRON_AFTERNOON ?? '0 15 * * 1-6',
    countryCode: process.env.COUNTRY_CODE ?? '52',
  },
});

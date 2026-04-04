// ─── Anti-Spam System ──────────────────────────────────────────────────────────
//
// Ephemeral in-memory tracking for text XP spam prevention and voice hop detection.

const messageHistory = new Map(); // `${userId}_${guildId}` -> { words: [], timestamps: [], lastMessage: '' }
const voiceHopTracker = new Map(); // `${userId}_${guildId}` -> { timestamps: [] }

const ONE_MINUTE = 60 * 1000;

/**
 * Check if a text message should earn XP or is considered spam.
 *
 * @param {string} userId
 * @param {string} guildId
 * @param {string} message - Raw message content
 * @param {object} guildSettings - Guild settings from cache
 * @returns {{ allowed: boolean, validWords: number, reason?: string }}
 */
function checkTextSpam(userId, guildId, message, guildSettings) {
  const key = `${userId}_${guildId}`;
  const now = Date.now();
  const maxMessages = guildSettings.anti_spam_max_messages || 10;

  // Initialize history for this user if needed
  if (!messageHistory.has(key)) {
    messageHistory.set(key, { words: [], timestamps: [], lastMessage: '' });
  }

  const history = messageHistory.get(key);

  // ── Check 1: Rate limit ──────────────────────────────────────────────────
  // Remove timestamps older than 1 minute
  history.timestamps = history.timestamps.filter((t) => now - t < ONE_MINUTE);

  if (history.timestamps.length >= maxMessages) {
    return { allowed: false, validWords: 0, reason: 'Mesaj hız limiti aşıldı.' };
  }

  // ── Check 2: Duplicate detection ─────────────────────────────────────────
  const trimmedMessage = message.trim().toLowerCase();
  if (trimmedMessage === history.lastMessage && trimmedMessage.length > 0) {
    return { allowed: false, validWords: 0, reason: 'Tekrarlanan mesaj tespit edildi.' };
  }

  // ── Check 3: Parse and validate words ────────────────────────────────────
  const rawWords = trimmedMessage.split(/\s+/).filter(Boolean);
  const validUniqueWords = new Set();

  for (const word of rawWords) {
    // Minimum word length: 2 characters
    if (word.length < 2) continue;

    // Gibberish filter: 3+ consecutive identical characters
    if (/(.)\1{2,}/.test(word)) continue;

    // Only count each unique word once (handles repeated words in same message)
    validUniqueWords.add(word);
  }

  const validWords = validUniqueWords.size;

  if (validWords === 0) {
    return { allowed: false, validWords: 0, reason: 'Geçerli kelime bulunamadı.' };
  }

  // Record this message
  history.timestamps.push(now);
  history.lastMessage = trimmedMessage;

  return { allowed: true, validWords };
}

/**
 * Check if a user is voice-channel hopping (switching channels too frequently).
 *
 * @param {string} userId
 * @param {string} guildId
 * @param {object} guildSettings - Guild settings from cache
 * @returns {boolean} true if the user is hopping
 */
function checkVoiceHop(userId, guildId, guildSettings) {
  const key = `${userId}_${guildId}`;
  const now = Date.now();
  const hopLimit = guildSettings.voice_hop_limit || 5;

  if (!voiceHopTracker.has(key)) {
    voiceHopTracker.set(key, { timestamps: [] });
  }

  const tracker = voiceHopTracker.get(key);

  // Remove entries older than 1 minute
  tracker.timestamps = tracker.timestamps.filter((t) => now - t < ONE_MINUTE);

  // Record this switch
  tracker.timestamps.push(now);

  return tracker.timestamps.length > hopLimit;
}

/**
 * Clean up old entries from tracking maps.
 * Should be called periodically (e.g. every 5 minutes).
 */
function cleanup() {
  const now = Date.now();
  const staleThreshold = 5 * ONE_MINUTE; // 5 minutes

  for (const [key, history] of messageHistory.entries()) {
    // Remove if no recent timestamps
    history.timestamps = history.timestamps.filter((t) => now - t < staleThreshold);
    if (history.timestamps.length === 0) {
      messageHistory.delete(key);
    }
  }

  for (const [key, tracker] of voiceHopTracker.entries()) {
    tracker.timestamps = tracker.timestamps.filter((t) => now - t < staleThreshold);
    if (tracker.timestamps.length === 0) {
      voiceHopTracker.delete(key);
    }
  }
}

module.exports = {
  checkTextSpam,
  checkVoiceHop,
  cleanup,
};

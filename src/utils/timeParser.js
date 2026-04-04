// ─── Turkish Time Parser ───────────────────────────────────────────────────────
//
// Format: "3g 1h 2a 1y"
//   g = gün (day)
//   h = hafta (week = 7 days)
//   a = ay (month = 30 days)
//   y = yıl (year = 365 days)

const UNITS = {
  g: 1,       // gün = 1 day
  h: 7,       // hafta = 7 days
  a: 30,      // ay = 30 days
  y: 365,     // yıl = 365 days
};

const MINUTES_PER_DAY = 1440;

/**
 * Parse a Turkish time string into total minutes.
 * @param {string} str - e.g. "1a 2h" or "3g" or "0"
 * @returns {number|null} Total minutes, or null if invalid
 */
function parseTime(str) {
  if (typeof str !== 'string') return null;

  const trimmed = str.trim();
  if (trimmed === '') return null;

  // Special case: bare "0"
  if (trimmed === '0') return 0;

  const segmentRegex = /(\d+)\s*([ghay])/gi;
  let totalDays = 0;
  let matched = false;
  let lastIndex = 0;
  let match;

  // Verify the entire string is valid segments separated by whitespace
  const cleaned = trimmed.replace(/\s+/g, ' ');

  while ((match = segmentRegex.exec(cleaned)) !== null) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (!UNITS[unit]) return null;

    totalDays += num * UNITS[unit];
    matched = true;
    lastIndex = segmentRegex.lastIndex;
  }

  if (!matched) return null;

  // Verify we consumed the entire string (no trailing garbage)
  const remaining = cleaned.slice(lastIndex).trim();
  if (remaining.length > 0) return null;

  return totalDays * MINUTES_PER_DAY;
}

/**
 * Convert voice minutes to level.
 * 15 XP per minute, 100 XP per level.
 * @param {number} minutes
 * @returns {number}
 */
function minutesToLevel(minutes) {
  return Math.floor(minutes * 15 / 100);
}

/**
 * Convert level back to required minutes.
 * @param {number} level
 * @returns {number}
 */
function levelToMinutes(level) {
  return Math.ceil(level * 100 / 15);
}

/**
 * Format minutes into human-readable Turkish duration.
 * @param {number} minutes
 * @returns {string} e.g. "1 yıl 2 ay 3 gün"
 */
function formatDuration(minutes) {
  if (minutes <= 0) return '0 gün';

  let totalDays = Math.floor(minutes / MINUTES_PER_DAY);
  const remainingMinutes = minutes % MINUTES_PER_DAY;

  const years = Math.floor(totalDays / 365);
  totalDays %= 365;

  const months = Math.floor(totalDays / 30);
  totalDays %= 30;

  const days = totalDays;
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  const parts = [];
  if (years > 0) parts.push(`${years} yıl`);
  if (months > 0) parts.push(`${months} ay`);
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (mins > 0) parts.push(`${mins} dakika`);

  return parts.length > 0 ? parts.join(' ') : '0 gün';
}

module.exports = {
  parseTime,
  minutesToLevel,
  levelToMinutes,
  formatDuration,
};

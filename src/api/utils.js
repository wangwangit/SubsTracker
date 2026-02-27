const CATEGORY_SEPARATOR_REGEX = /[\/，,\s]+/;

function getCookieValue(cookieString, key) {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp('(^| )' + key + '=([^;]+)'));
  return match ? match[2] : null;
}

function generateRandomSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function extractTagsFromSubscriptions(subscriptions = []) {
  const tagSet = new Set();
  (subscriptions || []).forEach(sub => {
    if (!sub || typeof sub !== 'object') return;
    if (Array.isArray(sub.tags)) {
      sub.tags.forEach(tag => {
        if (typeof tag === 'string' && tag.trim().length > 0) {
          tagSet.add(tag.trim());
        }
      });
    }
    if (typeof sub.category === 'string') {
      sub.category.split(CATEGORY_SEPARATOR_REGEX)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .forEach(tag => tagSet.add(tag));
    }
    if (typeof sub.customType === 'string' && sub.customType.trim().length > 0) {
      tagSet.add(sub.customType.trim());
    }
  });
  return Array.from(tagSet);
}

function sanitizeNotificationHours(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];

  return raw
    .map(value => String(value).trim())
    .filter(value => value.length > 0)
    .map(value => {
      const upperValue = value.toUpperCase();
      if (upperValue === '*' || upperValue === 'ALL') {
        return '*';
      }
      const numeric = Number(upperValue);
      if (!isNaN(numeric)) {
        return String(Math.max(0, Math.min(23, Math.floor(numeric)))).padStart(2, '0');
      }
      return upperValue;
    });
}

export {
  CATEGORY_SEPARATOR_REGEX,
  getCookieValue,
  generateRandomSecret,
  extractTagsFromSubscriptions,
  sanitizeNotificationHours
};

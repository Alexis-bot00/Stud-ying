export const PRESENCE_WINDOW_MS = 90000;

export function recordPresence(user, now = Date.now()) {
  if (!user.lastSeenAt || now - Date.parse(user.lastSeenAt) > PRESENCE_WINDOW_MS) {
    user.onlineSince = new Date(now).toISOString();
  }
  user.lastSeenAt = new Date(now).toISOString();
}

export function publicPresence(user, now = Date.now()) {
  const lastSeen = Date.parse(user.lastSeenAt);
  const online = Number.isFinite(lastSeen) && now - lastSeen <= PRESENCE_WINDOW_MS;
  return {
    online,
    lastSeenAt: Number.isFinite(lastSeen) ? user.lastSeenAt : null,
    onlineSeconds: online ? Math.max(0, Math.floor((now - Date.parse(user.onlineSince || user.lastSeenAt)) / 1000)) : 0,
  };
}

type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
};
export const accountCacheKey = (kind: string, id: string) => `studyante:${encodeURIComponent(id)}:${kind}`;
const sessionKey = 'studyante-account-session';
const legacyKeys = ['studyanteOfflineUser', 'studyanteOfflineLibrary'];

// Unowned legacy records are discarded, never guessed or assigned to a new account.
// Serialize writes with logout so a late response cannot recreate a cleared cache.
export function createAccountCache(store: Store) {
  let active: { userId: string; token: string } | null = null;
  let generation = 0;
  let pending = Promise.resolve();
  const queue = <T,>(work: () => Promise<T>): Promise<T> => {
    const result = pending.catch(() => {}).then(work);
    pending = result.then(() => {}, () => {});
    return result;
  };
  const discardLegacy = async () => { for (const key of legacyKeys) await store.removeItem(key); };
  return {
    async bind(userId: string, token: string) {
      const version = ++generation;
      active = { userId, token };
      await queue(async () => {
        await discardLegacy();
        if (generation === version) await store.setItem(sessionKey, JSON.stringify({ userId, token }));
      });
    },
    async restore(token: string) {
      const version = generation;
      return queue(async () => {
        await discardLegacy();
        let session;
        try { session = JSON.parse(await store.getItem(sessionKey) || 'null'); } catch { return null; }
        if (version !== generation || !token || session?.token !== token || typeof session?.userId !== 'string' || !session.userId) return null;
        active = { userId: session.userId, token };
        return session.userId as string;
      });
    },
    async write(kind: string, userId: string, value: unknown) {
      const version = generation;
      await queue(async () => {
        if (active?.userId !== userId || generation !== version) return;
        await store.setItem(accountCacheKey(kind, userId), JSON.stringify({ userId, value }));
      });
    },
    async read<T>(kind: string, userId: string): Promise<T | null> {
      const version = generation;
      return queue(async () => {
        if (active?.userId !== userId || generation !== version) return null;
        try {
          const entry = JSON.parse(await store.getItem(accountCacheKey(kind, userId)) || 'null');
          return entry?.userId === userId ? entry.value as T : null;
        } catch { return null; }
      });
    },
    async logout(userId?: string) {
      ++generation;
      active = null;
      await queue(async () => {
        await discardLegacy();
        await store.removeItem(sessionKey);
        await store.removeItem('cappy-auth-token');
        await store.removeItem('cappy-planner:guest');
        if (userId) {
          for (const key of await store.getAllKeys()) {
            if (key.startsWith(`studyante:${encodeURIComponent(userId)}:`) || key.startsWith(`circle-jacket:${userId}:`)) await store.removeItem(key);
          }
        }
      });
    },
  };
}

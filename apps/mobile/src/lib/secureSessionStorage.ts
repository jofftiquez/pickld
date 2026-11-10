import * as SecureStore from 'expo-secure-store';

// Supabase sessions are larger than SecureStore's ~2 KB per-item limit, so values are split into chunks:
// `<key>.n` holds the chunk count and `<key>.0`, `<key>.1`, … hold the parts.
export const CHUNK_SIZE = 1800;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function chunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}.n`, options);
  const n = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function removeChunks(key: string, from: number, to: number): Promise<void> {
  for (let i = from; i < to; i += 1) await SecureStore.deleteItemAsync(`${key}.${i}`, options);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = await chunkCount(key);
    if (n === 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`, options);
      if (part === null) return null; // a partial write is treated as no session
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await chunkCount(key);
    const n = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let i = 0; i < n; i += 1) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), options);
    }
    await SecureStore.setItemAsync(`${key}.n`, String(n), options);
    await removeChunks(key, n, previous);
  },

  async removeItem(key: string): Promise<void> {
    const n = await chunkCount(key);
    await SecureStore.deleteItemAsync(`${key}.n`, options);
    await removeChunks(key, 0, n);
  },
};

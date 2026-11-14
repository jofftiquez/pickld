// Sticker art that isn't bundled (D-131; FR-STK-02, FR-STK-04). Packs bundled with the app draw from stickerArt.ts;
// any other catalog sticker is downloaded once from the photo Worker's public `stickers/` keys (D-25) and kept in
// the app's documents folder, so it draws offline afterwards. The Worker's origin comes from fn:photo-urls; each
// sticker's size and art version come from the catalog (0100), remembered on this phone so moments size their
// stickers before the art arrives. Nothing here is per account: art is public catalog data.
import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import { z } from 'zod';
import { create } from 'zustand';

import { getSupabase } from '@/lib/supabase';

import { notifyAspectsChanged } from '../overlays/registry';
import { stickerArtFor } from './stickerArt';

/** A catalog sticker's art size in pixels and its art version (0100). */
export type ArtMeta = { width: number; height: number; version: number };

const ASSET = /^stickers\/([a-z0-9-]{1,40})\/([a-z0-9-]{1,60})\.png$/;
const STORE_KEY = 'stickerArt:v1';
const LOOKUP_BATCH = 100;

type State = {
  /** The photo Worker origin, e.g. https://photos.pickld.me; null until fn:photo-urls has answered once. */
  base: string | null;
  meta: Record<string, ArtMeta>;
  /** Downloaded files by asset path. */
  files: Record<string, string>;
  /** Art the Worker doesn't have (404) or that isn't a sticker key, this session only. */
  missing: Record<string, true>;
};

export const useRemoteStickerArt = create<State>(() => ({ base: null, meta: {}, files: {}, missing: {} }));

const savedSchema = z.object({
  base: z.string().nullable().catch(null),
  meta: z
    .record(
      z.string(),
      z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        version: z.number().int().positive(),
      }),
    )
    .catch({}),
});

let hydrated: Promise<void> | null = null;

/** Reads what this phone remembered (Worker origin, art sizes) once per app run. */
function hydrate(): Promise<void> {
  hydrated ??= Storage.getItem(STORE_KEY)
    .then((raw) => {
      const saved = savedSchema.safeParse(raw ? JSON.parse(raw) : null);
      if (!saved.success) return;
      useRemoteStickerArt.setState((s) => ({
        base: s.base ?? saved.data.base,
        meta: { ...saved.data.meta, ...s.meta },
      }));
      notifyAspectsChanged();
    })
    .catch(() => {});
  return hydrated;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveSoon(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { base, meta } = useRemoteStickerArt.getState();
    Storage.setItem(STORE_KEY, JSON.stringify({ base, meta })).catch(() => {});
  }, 300);
}

function setMeta(entries: [string, ArtMeta][]): void {
  if (entries.length === 0) return;
  const current = useRemoteStickerArt.getState().meta;
  const changed = entries.filter(([asset, m]) => {
    const old = current[asset];
    return !old || old.width !== m.width || old.height !== m.height || old.version !== m.version;
  });
  if (changed.length === 0) return;
  useRemoteStickerArt.setState((s) => ({ meta: { ...s.meta, ...Object.fromEntries(changed) } }));
  notifyAspectsChanged();
  saveSoon();
}

const catalogRowSchema = z.object({
  asset_path: z.string(),
  art_width: z.number().int().positive().nullable().catch(null),
  art_height: z.number().int().positive().nullable().catch(null),
  art_version: z.number().int().positive().catch(1),
});

/** Remembers the art size and version of catalog rows whose art isn't bundled. Other rows are ignored. */
export function rememberStickerArt(rows: readonly unknown[]): void {
  setMeta(
    rows.flatMap((row): [string, ArtMeta][] => {
      const r = catalogRowSchema.safeParse(row);
      if (!r.success || r.data.art_width === null || r.data.art_height === null) return [];
      if (stickerArtFor(r.data.asset_path)) return [];
      return [[r.data.asset_path, { width: r.data.art_width, height: r.data.art_height, version: r.data.art_version }]];
    }),
  );
}

/** The art's size in pixels: bundled art's, else the catalog's; undefined while unknown. */
export function stickerArtSize(asset: string): { width: number; height: number } | undefined {
  const bundled = stickerArtFor(asset);
  if (bundled) return bundled;
  const meta = useRemoteStickerArt.getState().meta[asset];
  return meta ? { width: meta.width, height: meta.height } : undefined;
}

/** True when the Stickers tool may offer this sticker: its art is bundled or the catalog says it is uploaded. */
export function hasStickerArt(row: {
  asset_path: string;
  art_width?: number | null;
  art_height?: number | null;
}): boolean {
  return stickerArtFor(row.asset_path) !== undefined || (row.art_width != null && row.art_height != null);
}

// ---------------------------------------------------------------- Worker origin
const baseResponse = z.object({ data: z.object({ stickerArtBase: z.url({ protocol: /^https?$/ }) }) });
let baseRequest: Promise<string | null> | null = null;

async function workerBase(): Promise<string | null> {
  const known = useRemoteStickerArt.getState().base;
  if (known) return known;
  baseRequest ??= getSupabase()
    .functions.invoke<unknown>('photo-urls', { body: { stickerArt: true } })
    .then(({ data, error }) => {
      const parsed = baseResponse.safeParse(data);
      if (error || !parsed.success) return null;
      const base = parsed.data.data.stickerArtBase.replace(/\/+$/, '');
      useRemoteStickerArt.setState({ base });
      saveSoon();
      return base;
    })
    .catch(() => null)
    .finally(() => {
      baseRequest = null;
    });
  return baseRequest;
}

// ---------------------------------------------------------------- catalog lookups for art seen on moments
// A moment can carry a sticker this phone has never seen in the catalog (another person's pack, a retired sticker).
// Its size and version are looked up in batches; the catalog is readable by every signed-in user (0001).
let pendingLookup: { assets: Set<string>; done: Promise<void> } | null = null;

function lookUp(asset: string): Promise<void> {
  if (!pendingLookup) {
    const assets = new Set<string>();
    const done = Promise.resolve().then(async () => {
      pendingLookup = null;
      const list = [...assets];
      for (let i = 0; i < list.length; i += LOOKUP_BATCH) {
        const { data, error } = await getSupabase()
          .from('stickers')
          .select('asset_path, art_width, art_height, art_version')
          .in('asset_path', list.slice(i, i + LOOKUP_BATCH));
        if (!error) rememberStickerArt(data ?? []);
      }
    });
    pendingLookup = { assets, done: done.catch(() => {}) };
  }
  pendingLookup.assets.add(asset);
  return pendingLookup.done;
}

// ---------------------------------------------------------------- files
function artFile(asset: string, version: number): File | null {
  const m = ASSET.exec(asset);
  if (!m) return null;
  return new File(new Directory(Paths.document, 'sticker-art', m[1] ?? ''), `${m[2] ?? ''}@${version}.png`);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from a PNG's header (IHDR), or null when the bytes aren't a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

const inFlight = new Map<string, Promise<void>>();

async function fetchArt(asset: string): Promise<void> {
  await hydrate();
  if (!useRemoteStickerArt.getState().meta[asset]) await lookUp(asset);
  const version = useRemoteStickerArt.getState().meta[asset]?.version ?? 1;
  const file = artFile(asset, version);
  if (!file) {
    useRemoteStickerArt.setState((s) => ({ missing: { ...s.missing, [asset]: true } }));
    return;
  }
  if (!file.exists) {
    const base = await workerBase();
    if (!base) return; // offline or not signed in: keep the placeholder and try again next time
    const res = await fetch(`${base}/${asset}?v=${version}`);
    if (res.status === 404 || res.status === 403) {
      useRemoteStickerArt.setState((s) => ({ missing: { ...s.missing, [asset]: true } }));
      return;
    }
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const size = pngSize(bytes);
    if (!size) {
      useRemoteStickerArt.setState((s) => ({ missing: { ...s.missing, [asset]: true } }));
      return;
    }
    if (file.parentDirectory && !file.parentDirectory.exists) file.parentDirectory.create({ intermediates: true });
    // Written beside the final name and moved, so a half-written file is never taken for the art.
    const part = new File(file.parentDirectory, `${file.name}.part`);
    if (part.exists) part.delete();
    part.write(bytes);
    part.move(file);
    if (!useRemoteStickerArt.getState().meta[asset]) setMeta([[asset, { ...size, version }]]);
  } else if (!useRemoteStickerArt.getState().meta[asset]) {
    const size = pngSize(await file.bytes());
    if (size) setMeta([[asset, { ...size, version }]]);
  }
  useRemoteStickerArt.setState((s) => ({ files: { ...s.files, [asset]: file.uri } }));
}

/** Downloads one sticker's art unless it is bundled, on disk already or being fetched. Never throws. */
export function requestStickerArt(asset: string): Promise<void> {
  if (stickerArtFor(asset)) return Promise.resolve();
  const state = useRemoteStickerArt.getState();
  if (state.files[asset] || state.missing[asset]) return Promise.resolve();
  let request = inFlight.get(asset);
  if (!request) {
    request = fetchArt(asset)
      .catch(() => {})
      .finally(() => inFlight.delete(asset));
    inFlight.set(asset, request);
  }
  return request;
}

/**
 * Waits for several stickers' art, e.g. before a share card is drawn into an image. Resolves true when some of
 * it wasn't on the phone yet, so the caller can give the views a moment to draw it.
 */
export async function settleStickerArt(assets: readonly string[]): Promise<boolean> {
  const { files, missing } = useRemoteStickerArt.getState();
  const waiting = [...new Set(assets)].filter((a) => !stickerArtFor(a) && !files[a] && !missing[a]);
  await Promise.all(waiting.map(requestStickerArt));
  return waiting.length > 0;
}

export type StickerArtSource =
  { kind: 'bundled'; source: number } | { kind: 'file'; uri: string } | { kind: 'loading' } | { kind: 'missing' };

/** Where to draw a sticker's art from right now, downloading it if needed. */
export function useStickerArtSource(asset: string): StickerArtSource {
  const bundled = stickerArtFor(asset);
  const uri = useRemoteStickerArt((s) => s.files[asset]);
  const missing = useRemoteStickerArt((s) => s.missing[asset] === true);
  useEffect(() => {
    if (!bundled) void requestStickerArt(asset);
  }, [asset, bundled]);
  if (bundled) return { kind: 'bundled', source: bundled.source };
  if (uri) return { kind: 'file', uri };
  return missing ? { kind: 'missing' } : { kind: 'loading' };
}

/** Clears the in-memory state (tests). */
export function resetRemoteStickerArt(): void {
  hydrated = null;
  baseRequest = null;
  pendingLookup = null;
  inFlight.clear();
  useRemoteStickerArt.setState({ base: null, meta: {}, files: {}, missing: {} }, true);
}

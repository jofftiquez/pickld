import { photoCacheKey, photoSource } from '../photoCache';

const key = 'moments/0b5c6f1e-3f0a-4c55-9f0e-6a1b2c3d4e5f/7a1b2c3d-4e5f-4a55-9f0e-0b5c6f1e3f0a/full.jpg';

describe('photoCacheKey', () => {
  it('gives the same key for two signatures of one photo', () => {
    const first = `https://photos.pickld.me/${key}?exp=1800000000&sig=abc_-123`;
    const later = `https://photos.pickld.me/${key}?exp=1800000915&sig=zzz999`;
    expect(photoCacheKey(first)).toBe(key);
    expect(photoCacheKey(later)).toBe(key);
  });

  it('tells photos apart', () => {
    const thumb = key.replace('full.jpg', 'thumb.jpg');
    expect(photoCacheKey(`http://127.0.0.1:55430/${thumb}?exp=1&sig=a`)).toBe(thumb);
  });

  it('leaves anything that is not a signed photo link alone', () => {
    expect(photoCacheKey('file:///var/mobile/cache/photo.webp')).toBeNull();
    expect(photoCacheKey('https://photos.pickld.me/stickers/pets/cat.png?v=2')).toBeNull();
    expect(photoCacheKey(`https://photos.pickld.me/${key}`)).toBeNull();
  });
});

describe('photoSource', () => {
  it('caches a signed link under its object key and a local file as is', () => {
    const link = `https://photos.pickld.me/${key}?exp=1800000000&sig=abc`;
    expect(photoSource(link)).toEqual({ uri: link, cacheKey: key });
    expect(photoSource('file:///tmp/a.webp')).toEqual({ uri: 'file:///tmp/a.webp' });
  });
});

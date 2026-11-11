import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';

import { parseEdits, type Edits } from '@/features/edit/edits';
import { filterMatrices } from '@/features/edit/filters';
import { stickerArt } from '@/features/edit/stickers/stickerArt';

import { MomentView } from '../MomentView';

// The moment renderer (M2-18, FR-CAP-08, FR-STK-04): one read-only picture drawn from `edits` that is
// the same at tile, detail and share card sizes, only scaled. Skia is the shared jest stand-in, which
// shows the decoded URI and the filter matrix; the overlays are the editor's own renderers.

const URI = 'https://photos.test/m1/thumb.webp';
// Today tile (2 columns on a 390-point phone), moment detail, share card in pixels.
const WIDTHS = [170, 390, 1080] as const;

const BUBBLE_TEXT = 'Kain na tayo, ang sarap ng ulam today grabe';
const TEXT_TEXT = 'Monday mood and a very long line of words';

// Ids are md5-shaped catalog ids (0012); `one-year` is an earned Milestones sticker nobody buys, and the
// renderer is never told whether the viewer owns any pack.
const edits: Edits = {
  v: 1,
  filter: 'original',
  overlays: [
    {
      id: 's1',
      type: 'sticker',
      stickerId: '0b6c5c8e-6f43-2a1e-9b55-3f1a0c2d4e5f',
      asset: 'stickers/milestones/one-year.png',
      label: 'One year',
      x: 0.3,
      y: 0.2,
      scale: 0.45,
      rotation: 0.4,
    },
    {
      id: 's2',
      type: 'sticker',
      stickerId: '1c7d6d9f-7054-3b2f-ac66-402b1d3e5f60',
      asset: 'stickers/stamps/time.png',
      label: 'Time',
      stamp: 'time',
      x: 0.7,
      y: 0.85,
      scale: 0.3,
      rotation: -0.2,
    },
    {
      id: 'b1',
      type: 'bubble',
      shape: 'speech',
      color: 'pickle',
      text: BUBBLE_TEXT,
      x: 0.6,
      y: 0.45,
      scale: 0.5,
      rotation: 0.1,
    },
    {
      id: 't1',
      type: 'text',
      text: TEXT_TEXT,
      font: 'serif',
      color: 'white',
      size: 40,
      align: 'center',
      x: 0.5,
      y: 0.65,
      scale: 0.7,
      rotation: -0.3,
    },
  ],
};

const STAMP = { capturedAt: new Date('2026-11-11T06:14:00Z'), tz: 'Asia/Manila' };

type Node = ReturnType<typeof screen.getByTestId>;

function styleOf(node: Node): ViewStyle & { fontSize?: number; lineHeight?: number } {
  return StyleSheet.flatten(node.props.style);
}

function textIn(testID: string): Node {
  // Each overlay draws exactly one run of text.
  const texts = within(screen.getByTestId(testID)).getAllByText(/[\s\S]+/);
  expect(texts).toHaveLength(1);
  const [text] = texts;
  if (!text) throw new Error(`no text in ${testID}`);
  return text;
}

/** The art an expo-image draws (its mock wraps the source in an array). */
function sourceOf(testID: string): unknown {
  const source: unknown = screen.getByTestId(testID).props.source;
  return Array.isArray(source) ? source[0] : source;
}

type HostNode = { props: Record<string, unknown>; children: (HostNode | string)[] | null };

/** Every host element in a rendered tree. */
function hostNodes(json: unknown): HostNode[] {
  if (json === null || typeof json !== 'object') return [];
  if (Array.isArray(json)) return json.flatMap(hostNodes);
  const node = json as HostNode;
  return [node, ...(node.children ?? []).flatMap(hostNodes)];
}

type Measured = {
  boxes: Record<string, { left: number; top: number; width: number; height: number; rotate: unknown }>;
  bubble: { fontSize: number; lineHeight: number; lines: number; text: unknown };
  text: { fontSize: number; lineHeight: number; text: unknown };
  stamp: { fontSize: number; text: unknown };
};

async function measureAt(width: number): Promise<Measured> {
  const view = await render(<MomentView uri={URI} edits={edits} width={width} stamp={STAMP} />);
  const boxes: Measured['boxes'] = {};
  for (const { id } of edits.overlays) {
    const s = styleOf(screen.getByTestId(`moment-overlay-${id}`));
    boxes[id] = {
      left: Number(s.left),
      top: Number(s.top),
      width: Number(s.width),
      height: Number(s.height),
      rotate: s.transform,
    };
  }
  const bubble = textIn('bubble-b1');
  const text = textIn('text-overlay-t1');
  const stamp = textIn('sticker-s2');
  const measured: Measured = {
    boxes,
    bubble: {
      fontSize: Number(styleOf(bubble).fontSize),
      lineHeight: Number(styleOf(bubble).lineHeight),
      lines: bubble.props.numberOfLines,
      text: bubble.props.children,
    },
    text: {
      fontSize: Number(styleOf(text).fontSize),
      lineHeight: Number(styleOf(text).lineHeight),
      text: text.props.children,
    },
    stamp: { fontSize: Number(styleOf(stamp).fontSize), text: stamp.props.children },
  };
  await view.unmount();
  return measured;
}

describe('MomentView: the same picture at every size', () => {
  it('scales every overlay box and font size exactly with the width, keeping rotation and line breaks', async () => {
    // One size at a time: renders share the screen.
    const [tile, detail, card] = [
      [WIDTHS[0], await measureAt(WIDTHS[0])],
      [WIDTHS[1], await measureAt(WIDTHS[1])],
      [WIDTHS[2], await measureAt(WIDTHS[2])],
    ] as const;
    const base = detail[1];
    const baseK = detail[0];

    // The detail size itself is right: the sticker's box is scale × width, centred on (x, y).
    expect(base.boxes.s1?.width).toBeCloseTo(0.45 * 390, 9);
    expect((base.boxes.s1?.left ?? 0) + (base.boxes.s1?.width ?? 0) / 2).toBeCloseTo(0.3 * 390, 9);
    expect((base.boxes.s1?.top ?? 0) + (base.boxes.s1?.height ?? 0) / 2).toBeCloseTo(0.2 * 520, 9);

    // Wrapping is real, so "same lines at every size" means something.
    expect(base.bubble.lines).toBeGreaterThan(1);
    expect(String(base.text.text).split('\n').length).toBeGreaterThan(1);

    for (const [w, m] of [tile, card]) {
      const k = w / baseK;
      for (const { id } of edits.overlays) {
        const a = m.boxes[id];
        const b = base.boxes[id];
        if (!a || !b) throw new Error(`missing ${id}`);
        expect(a.left).toBeCloseTo(b.left * k, 9);
        expect(a.top).toBeCloseTo(b.top * k, 9);
        expect(a.width).toBeCloseTo(b.width * k, 9);
        expect(a.height).toBeCloseTo(b.height * k, 9);
        expect(a.rotate).toEqual(b.rotate);
      }
      expect(m.bubble.fontSize).toBeCloseTo(base.bubble.fontSize * k, 9);
      expect(m.bubble.lineHeight).toBeCloseTo(base.bubble.lineHeight * k, 9);
      expect(m.bubble.lines).toBe(base.bubble.lines);
      expect(m.bubble.text).toBe(BUBBLE_TEXT);
      expect(m.text.fontSize).toBeCloseTo(base.text.fontSize * k, 9);
      expect(m.text.lineHeight).toBeCloseTo(base.text.lineHeight * k, 9);
      expect(m.text.text).toBe(base.text.text);
      expect(m.stamp.fontSize).toBeCloseTo(base.stamp.fontSize * k, 9);
      expect(m.stamp.text).toBe(base.stamp.text);
    }
    expect(base.boxes.s1?.rotate).toEqual([{ rotate: '0.4rad' }]);
  });

  it('is 3:4 at any width', async () => {
    await render(<MomentView uri={URI} edits={edits} width={1080} testID="mv" />);
    expect(styleOf(screen.getByTestId('mv'))).toMatchObject({ width: 1080, height: 1440 });
  });
});

describe('MomentView: content', () => {
  it('draws a sticker from a pack the viewer does not own, from its bundled art by asset path', async () => {
    await render(<MomentView uri={URI} edits={edits} width={390} />);
    const art = stickerArt['stickers/milestones/one-year.png'];
    expect(art).toBeDefined();
    expect(sourceOf('sticker-s1')).toEqual(art?.source);
  });

  it('auto stamps show the moment’s values from the stamp context, and their art without one', async () => {
    const time = edits.overlays[1];
    if (time?.type !== 'sticker') throw new Error('fixture');
    const jar: Edits = {
      ...edits,
      overlays: [time, { ...time, id: 'j1', stamp: 'jar_number', asset: 'stickers/stamps/jar-number.png' }],
    };
    const view = await render(<MomentView uri={URI} edits={jar} width={390} stamp={{ ...STAMP, jarNumber: 42 }} />);
    expect(within(screen.getByTestId('sticker-j1')).getByText('JAR #42')).toBeTruthy();
    expect(within(screen.getByTestId('sticker-s2')).getByText('2:14 PM')).toBeTruthy();
    await view.unmount();

    await render(<MomentView uri={URI} edits={jar} width={390} />);
    expect(sourceOf('sticker-s2')).toEqual(stickerArt['stickers/stamps/time.png']?.source);
    expect(sourceOf('sticker-j1')).toEqual(stickerArt['stickers/stamps/jar-number.png']?.source);
  });

  it('a sticker whose art this app lacks keeps its place without breaking the picture', async () => {
    const unknown = parseEdits({
      filter: 'original',
      overlays: [{ ...edits.overlays[0], asset: 'stickers/future-pack/new-one.png' }],
    });
    await render(<MomentView uri={URI} edits={unknown} width={390} />);
    expect(screen.getByTestId('moment-overlay-s1')).toBeTruthy();
    expect(sourceOf('sticker-s1')).toBeUndefined();
    expect(screen.getByTestId('moment-view-photo')).toBeTruthy();
  });

  it('draws the photo with its color filter through Skia', async () => {
    await render(<MomentView uri={URI} edits={{ ...edits, filter: 'dusk' }} width={390} />);
    expect(screen.getByTestId('skia-image').props.accessibilityHint).toBe(URI);
    expect(JSON.parse(screen.getByTestId('color-matrix').props.accessibilityValue.text)).toEqual([
      ...filterMatrices.dusk,
    ]);
    expect(screen.queryByTestId('moment-view-photo')).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['old, from before version 1', {}],
    ['bad', { v: 9, filter: 'sepia-glow', overlays: 'lots' }],
    ['bad overlays', { filter: 'original', overlays: [{ type: 'sticker', id: 'x' }, { type: 'confetti' }] }],
  ])('%s edits draw the plain photo', async (_name, raw) => {
    await render(<MomentView uri={URI} edits={parseEdits(raw)} width={390} />);
    expect(sourceOf('moment-view-photo')).toEqual({ uri: URI });
    expect(screen.queryByTestId('skia-image')).toBeNull();
    expect(screen.queryAllByTestId(/^moment-overlay-/)).toHaveLength(0);
    expect(screen.getByRole('image', { name: 'Photo' })).toBeTruthy();
  });

  it('is one image for screen readers, labelled without the user’s words, with nothing to press', async () => {
    const view = await render(<MomentView uri={URI} edits={edits} width={390} testID="mv" />);
    const root = screen.getByTestId('mv');
    expect(root.props.pointerEvents).toBe('none');
    expect(screen.getByRole('image', { name: 'Photo with 2 stickers, a speech bubble and text' })).toBe(root);

    // Nothing in the tree is a control or reacts to touch, and only the root is focusable.
    const all = hostNodes(screen.toJSON());
    expect(all.length).toBeGreaterThan(8);
    const inner = all.filter((n) => n.props.testID !== 'mv');
    expect(all.filter((n) => n.props.onPress || n.props.onPressIn || n.props.onResponderGrant)).toHaveLength(0);
    expect(all.filter((n) => n.props.onStartShouldSetResponder || n.props.onClick)).toHaveLength(0);
    expect(all.filter((n) => n.props.accessibilityRole === 'button')).toHaveLength(0);
    expect(inner.filter((n) => n.props.accessible === true)).toHaveLength(0);
    expect(inner.filter((n) => typeof n.props.accessibilityLabel === 'string')).toHaveLength(0);
    expect(root.props.accessibilityLabel).not.toMatch(/Kain|Monday|One year/);
    await view.unmount();

    // Inside a control that already speaks (a Today tile), it hides itself.
    await render(<MomentView uri={URI} edits={edits} width={170} accessible={false} testID="mv" />);
    expect(screen.queryByTestId('mv')).toBeNull();
    const hidden = screen.getByTestId('mv', { includeHiddenElements: true });
    expect(hidden.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(hidden.props.accessibilityLabel).toBeUndefined();
  });
});

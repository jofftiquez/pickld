import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { QueuedMoment } from '@/features/jar/todayGrid';
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { removeItem, replaceItem } from '@/lib/queue/store';
import { sizes } from '@/theme/tokens';

import { ConflictReplacePrompt } from '../ConflictReplacePrompt';
import { ReplaceDialog } from '../ReplaceDialog';
import { keepCurrentPhoto, nextConflict, replaceUpload } from '../replaceUpload';

// Replace (M2-22, FR-JAR-03): the dialog, what each choice does with the queued photo, and the prompt Today
// shows for an upload that ended as a conflict. The queue store and worker are mocked; their own tests
// cover replaceItem and the replacement upload.

jest.mock('@/lib/queue/store', () => ({ replaceItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn() }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
// The kit's Dialog reads Reduce Motion from Reanimated, whose native module can't load in Jest.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));

const order: string[] = [];

beforeEach(() => {
  order.length = 0;
  jest
    .mocked(replaceItem)
    .mockReset()
    .mockImplementation(async (id) => {
      order.push(`replace:${id}`);
      return {} as never;
    });
  jest
    .mocked(removeItem)
    .mockReset()
    .mockImplementation(async (id) => {
      order.push(`remove:${id}`);
    });
  jest
    .mocked(requestUploads)
    .mockReset()
    .mockImplementation(async () => {
      order.push('requestUploads');
    });
  jest.mocked(captureError).mockReset();
});

describe('ReplaceDialog', () => {
  it('names the slot, says the old photo stays, and offers Replace, Keep current photo and Cancel', async () => {
    const onReplace = jest.fn();
    const onKeep = jest.fn();
    const onClose = jest.fn();
    await render(<ReplaceDialog visible slot="morning" onReplace={onReplace} onKeep={onKeep} onClose={onClose} />);

    expect(screen.getByRole('header', { name: 'Replace your #morning photo?' })).toBeTruthy();
    expect(screen.getByText('Your current photo stays up until the new one is checked.')).toBeTruthy();
    const keep = screen.getByRole('button', { name: 'Keep current photo' });
    expect(keep.props.accessibilityHint).toBe('Deletes the new photo from your phone');

    await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
    expect(onReplace).toHaveBeenCalledTimes(1);
    await fireEvent.press(keep);
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('every action is at least the minimum tap size', async () => {
    await render(<ReplaceDialog visible slot="ootd" onReplace={jest.fn()} onKeep={jest.fn()} onClose={jest.fn()} />);
    for (const name of ['Replace', 'Keep current photo']) {
      const style = [screen.getByRole('button', { name }).props.style].flat(5) as {
        minHeight?: number;
        height?: number;
      }[];
      const height = Math.max(...style.map((s) => s?.minHeight ?? s?.height ?? 0));
      expect(height).toBeGreaterThanOrEqual(sizes.minTap);
    }
  });

  it('without onKeep (the camera, before any photo) there is no Keep button', async () => {
    await render(<ReplaceDialog visible slot="ootd" onReplace={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Keep current photo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
  });
});

describe('replaceUpload / keepCurrentPhoto', () => {
  it('Replace re-queues the item as a replacement, then asks the worker to drain now', async () => {
    await replaceUpload(4);
    expect(order).toEqual(['replace:4', 'requestUploads']);
  });

  it('Replace on an item that is no longer a conflict reports it and does not kick the worker', async () => {
    jest.mocked(replaceItem).mockRejectedValueOnce(new Error('Cannot replace an item that is queued'));
    await replaceUpload(4);
    expect(requestUploads).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'replace-upload' });
  });

  it('Keep current photo drops the new photo and does not upload anything', async () => {
    await keepCurrentPhoto(4);
    expect(order).toEqual(['remove:4']);
  });

  it('nextConflict: the oldest conflict not dismissed, or null', () => {
    const q = [
      { id: 9, state: 'conflict' as const },
      { id: 3, state: 'failed' as const },
      { id: 5, state: 'conflict' as const },
    ];
    expect(nextConflict(q, new Set())?.id).toBe(5);
    expect(nextConflict(q, new Set([5]))?.id).toBe(9);
    expect(nextConflict(q, new Set([5, 9]))).toBeNull();
  });
});

describe('ConflictReplacePrompt (Today, upload ended as a conflict)', () => {
  const item = (id: number, state: QueuedMoment['state'], slot: QueuedMoment['slot'] = 'selfie') => ({
    id,
    state,
    slot,
  });

  it('shows nothing when no upload is a conflict', async () => {
    await render(<ConflictReplacePrompt queue={[item(1, 'queued'), item(2, 'failed')]} />);
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('asks about the oldest conflict; Replace re-queues it as a replacement', async () => {
    await render(<ConflictReplacePrompt queue={[item(8, 'conflict', 'ootd'), item(2, 'conflict', 'selfie')]} />);
    expect(screen.getByRole('header', { name: 'Replace your #selfie photo?' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Replace' }));
    await act(async () => {});
    expect(order).toEqual(['replace:2', 'requestUploads']);
    // The next conflict is asked about at once.
    expect(screen.getByRole('header', { name: 'Replace your #ootd photo?' })).toBeTruthy();
  });

  it('Keep current photo drops the new photo', async () => {
    await render(<ConflictReplacePrompt queue={[item(2, 'conflict')]} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep current photo' }));
    await act(async () => {});
    expect(order).toEqual(['remove:2']);
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('Not now changes nothing and stops asking about that photo', async () => {
    const queue = [item(2, 'conflict')];
    const view = await render(<ConflictReplacePrompt queue={queue} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await act(async () => {});
    expect(order).toEqual([]);
    expect(screen.queryByRole('header')).toBeNull();
    await view.rerender(<ConflictReplacePrompt queue={[...queue]} />);
    expect(screen.queryByRole('header')).toBeNull();
  });
});

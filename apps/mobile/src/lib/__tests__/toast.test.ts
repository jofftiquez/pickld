import { showToast, useToastStore } from '../toast';

// The success toast store (D-63): one toast at a time, the newest wins.

beforeEach(() => useToastStore.setState({ current: null }));

describe('showToast', () => {
  it('shows a toast by its en.json key, with its values', () => {
    showToast('momentMoved', { slot: '#evening' });
    expect(useToastStore.getState().current).toMatchObject({ key: 'momentMoved', params: { slot: '#evening' } });
  });

  it('replaces the toast on screen with a new one', () => {
    showToast('linkCopied');
    const first = useToastStore.getState().current!;
    showToast('imageSaved');
    const second = useToastStore.getState().current!;
    expect(second.key).toBe('imageSaved');
    expect(second.id).not.toBe(first.id);
    expect(second.params).toBeUndefined();
  });

  it('hiding an old toast leaves the one that replaced it', () => {
    showToast('linkCopied');
    const first = useToastStore.getState().current!;
    showToast('imageSaved');
    useToastStore.getState().hide(first.id);
    expect(useToastStore.getState().current?.key).toBe('imageSaved');
    useToastStore.getState().hide(useToastStore.getState().current!.id);
    expect(useToastStore.getState().current).toBeNull();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { parseEdits } from '@/features/edit/edits';

import { buildThread, COMMENT_MAX, type CommentRow } from '../commentsModel';
import { CommentsView, type CommentsViewProps } from '../CommentsView';

// The delete Dialog and the list's scroll-to-end only ask Reanimated whether Reduce Motion is on.
jest.mock('react-native-reanimated', () => ({ __esModule: true, useReducedMotion: () => false }));

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const NOW = new Date('2026-11-08T12:00:00Z');
const ME = 'dale-id';

const rows: CommentRow[] = [
  {
    id: 'c1',
    jar_id: 'jar-1',
    user_id: 'mika-id',
    parent_id: null,
    body: 'Lola’s house always looks like the best Sunday.',
    is_hidden: false,
    created_at: '2026-11-08T10:00:00Z',
    author: { display_name: 'Mika Reyes', username: 'mika' },
  },
  {
    id: 'c2',
    jar_id: 'jar-1',
    user_id: ME,
    parent_id: 'c1',
    body: 'Next time you’re coming with us',
    is_hidden: true,
    created_at: '2026-11-08T11:00:00Z',
    author: { display_name: 'Dale Santos', username: 'dale' },
  },
];

async function setup(props: Partial<CommentsViewProps> = {}) {
  const handlers = {
    onBack: jest.fn(),
    onRetry: jest.fn(),
    onSend: jest.fn(async () => true),
    onDelete: jest.fn(),
  };
  await render(
    <CommentsView
      jarTitle="Mika’s Sunday"
      count={1}
      // Viewed by a reader (not the jar owner).
      thread={buildThread(rows, ME, 'mika-id')}
      failed={false}
      unavailable={false}
      myName="Dale Santos"
      now={NOW}
      insets={insets}
      isSending={false}
      sendFailed={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('CommentsView', () => {
  it('shows the header, the comment with its age, and my own reply as checking', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Comments' })).toBeTruthy();
    expect(screen.getByTestId('comments-subtitle')).toHaveTextContent('Mika’s Sunday · 1');
    expect(screen.getByTestId('comment-c1')).toHaveTextContent(/Mika Reyes · 2h/);
    expect(screen.getByTestId('comment-c2')).toHaveTextContent(/Dale Santos · Checking…/);
  });

  it('offers Reply on top-level comments only, and Delete on my own comments only', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Reply to Mika Reyes' })).toBeTruthy();
    expect(screen.queryByTestId('comment-c2-reply')).toBeNull();
    expect(screen.queryByTestId('comment-c1-delete')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Dale Santos’s comment' })).toBeTruthy();
  });

  it('replies to a comment and clears the input once it is saved', async () => {
    const { onSend } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Reply to Mika Reyes' }));
    expect(screen.getByTestId('comments-replying')).toHaveTextContent('Replying to Mika Reyes');
    await fireEvent.changeText(screen.getByTestId('comments-input'), '  See you there  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('See you there', 'c1');
    expect(screen.getByTestId('comments-input')).toHaveProp('value', '');
    expect(screen.queryByTestId('comments-replying')).toBeNull();
  });

  it('keeps the text when saving failed', async () => {
    const onSend = jest.fn(async () => false);
    await setup({ onSend, sendFailed: true });
    await fireEvent.changeText(screen.getByTestId('comments-input'), 'Hello');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByTestId('comments-input')).toHaveProp('value', 'Hello');
    expect(screen.getByTestId('comments-send-failed')).toBeTruthy();
  });

  it('does not send empty text, and counts down near the 300-character limit', async () => {
    const { onSend } = await setup();
    await fireEvent.changeText(screen.getByTestId('comments-input'), '   ');
    await fireEvent.press(screen.getByTestId('comments-send'));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId('comments-input')).toHaveProp('maxLength', COMMENT_MAX);
    expect(screen.queryByTestId('comments-counter')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('comments-input'), 'x'.repeat(COMMENT_MAX - 1));
    expect(screen.getByTestId('comments-counter')).toHaveTextContent('1 character left');
  });

  it('deletes a comment only after confirming', async () => {
    const { onDelete } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Dale Santos’s comment' }));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('comments-delete-confirm'));
    expect(onDelete).toHaveBeenCalledWith('c2');
  });

  // A sticker and a text overlay, as Moment detail draws them (D-84).
  const momentEdits = parseEdits({
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
        id: 't1',
        type: 'text',
        text: 'Sunday!',
        font: 'serif',
        color: 'white',
        x: 0.5,
        y: 0.7,
        scale: 0.5,
        rotation: 0,
      },
    ],
  });
  const momentProps: Partial<CommentsViewProps> = {
    jarTitle: 'Mika’s #morning',
    count: 4,
    moment: {
      uri: 'https://photos.test/m1/full.webp',
      edits: momentEdits,
      stamp: null,
      slot: '#morning',
      authorName: 'Mika Reyes',
      caption: 'Pandesal run.',
    },
  };

  it('opens a moment thread with the whole moment at 3:4, full width, then author, caption and comments (D-84)', async () => {
    await setup(momentProps);
    expect(screen.getByTestId('comments-subtitle')).toHaveTextContent('Mika’s #morning · 4');
    // Moment detail's renderer, edge to edge at the window's width, 3:4.
    const view = screen.getByTestId('comments-moment-view', { includeHiddenElements: true });
    const { width, height } = StyleSheet.flatten(view.props.style) as { width: number; height: number };
    expect(width).toBe(750);
    expect(height).toBe(1000);
    expect(within(view).getByTestId('moment-view-photo', { includeHiddenElements: true })).toHaveProp('source', [
      { uri: 'https://photos.test/m1/full.webp' },
    ]);
    expect(within(view).getByTestId('moment-overlay-s1', { includeHiddenElements: true })).toBeTruthy();
    expect(within(view).getByTestId('moment-overlay-t1', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('image', { name: '#morning photo' })).toBeTruthy();
    expect(screen.getByTestId('comments-moment-author')).toHaveTextContent('Mika Reyes');
    expect(screen.getByTestId('comments-moment-caption')).toHaveTextContent('Pandesal run.');
    // The moment heads the scrolling list, above the comments; the composer stays outside it.
    const list = screen.getByTestId('comments-list');
    expect(within(list).getByTestId('comments-moment')).toBeTruthy();
    expect(within(list).getByTestId('comment-c1')).toBeTruthy();
    expect(within(list).queryByTestId('comments-input')).toBeNull();
    expect(screen.getByTestId('comments-input')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });

  it('keeps the moment above a moment thread that is empty or still loading', async () => {
    await setup({ ...momentProps, thread: [] });
    expect(within(screen.getByTestId('comments-list')).getByTestId('comments-empty')).toBeTruthy();
    await setup({ ...momentProps, thread: undefined });
    expect(screen.getByTestId('comments-moment-view', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Loading comments')).toBeTruthy();
  });

  it('shows no moment, only “not available”, when the viewer can’t see it', async () => {
    await setup({ ...momentProps, unavailable: true, thread: undefined });
    expect(screen.getByTestId('comments-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('comments-moment-view', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('moment-view-photo', { includeHiddenElements: true })).toBeNull();
  });

  it('has no moment header on the jar thread, and keeps the composer', async () => {
    await setup();
    expect(screen.queryByTestId('comments-moment')).toBeNull();
    expect(screen.queryByTestId('comments-moment-view', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('comments-card')).toBeTruthy();
    expect(screen.getByTestId('comments-input')).toBeTruthy();
  });

  it('shows an empty thread, and hides the input on a jar the viewer can’t see', async () => {
    await setup({ thread: [] });
    expect(screen.getByTestId('comments-empty')).toHaveTextContent('No comments yet. Say something kind.');
    await setup({ unavailable: true, thread: undefined });
    expect(screen.getByTestId('comments-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('comments-input')).toBeNull();
  });
});

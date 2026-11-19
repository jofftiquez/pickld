// Gesture-handler's own jest mocks for its native module (not in the shared jest setup).
import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { editsSchema, type Edits, type Place } from '../edits';
import { OverlayLayer } from '../overlays/OverlayLayer';
import { unregisterOverlayRenderer } from '../overlays/registry';
import type { PlaceLookup } from '../place/currentPlace';
import { PlacePanel } from '../place/PlacePanel';
import { registerPlaceRenderer } from '../place/PlaceOverlay';
import { useEditorState } from '../useEditorState';

// The Place panel wired to the real editor state and overlay layer, so each keystroke and tap is checked
// on the edits that get saved and the sticker drawn on the photo.
jest.mock('react-native-reanimated', () => jest.requireActual('./reanimatedStandIn'));

const EMPTY: Edits = { v: 1, filter: 'original', overlays: [] };

function Harness({ initial = EMPTY, lookUp }: { initial?: Edits; lookUp: () => Promise<PlaceLookup> }) {
  const editor = useEditorState(initial);
  const selected = editor.edits.overlays.find((o): o is Place => o.type === 'place' && o.id === editor.selectedId);
  return (
    <GestureHandlerRootView>
      <OverlayLayer
        overlays={editor.edits.overlays}
        selectedId={editor.selectedId}
        width={300}
        height={400}
        onSelect={editor.selectOverlay}
        onTransform={editor.transformOverlay}
        onBringToFront={editor.bringToFront}
        onDelete={editor.deleteOverlay}
      />
      <PlacePanel
        selected={selected ?? null}
        onAdd={editor.addOverlay}
        onUpdate={editor.updateOverlay}
        lookUp={lookUp}
      />
      <Pressable accessibilityLabel="Undo" onPress={editor.undo} testID="undo" />
      <Text testID="edits">{JSON.stringify(editor.edits)}</Text>
    </GestureHandlerRootView>
  );
}

const edits = (): Edits => editsSchema.parse(JSON.parse(String(screen.getByTestId('edits').props.children)));
const field = () => screen.getByLabelText('Place');
const useCurrent = () => screen.getByRole('button', { name: 'Use where I am' });
const never = () => new Promise<PlaceLookup>(() => {});

beforeAll(() => registerPlaceRenderer());
afterAll(() => unregisterOverlayRenderer('place'));

describe('PlacePanel', () => {
  it('adds nothing until the user types or asks; typing shows the place on the photo', async () => {
    const lookUp = jest.fn(never);
    await render(<Harness lookUp={lookUp} />);
    expect(edits().overlays).toEqual([]);
    expect(lookUp).not.toHaveBeenCalled();
    expect(screen.getByText('Only the words on the sticker are saved. Pickld never saves where you are.')).toBeTruthy();

    await fireEvent.changeText(field(), 'Sa');
    await fireEvent.changeText(field(), 'Sagada');
    expect(edits().overlays).toHaveLength(1);
    expect(edits().overlays[0]).toMatchObject({ type: 'place', text: 'Sagada', color: 'white' });
    expect(screen.getByRole('button', { name: 'Place: Sagada' })).toBeTruthy();
    // Typing into one place is one Undo step.
    await fireEvent.press(screen.getByTestId('undo'));
    expect(edits().overlays).toEqual([]);
  });

  it('a longer name keeps its letters the same size: the sticker widens with it', async () => {
    await render(<Harness lookUp={never} />);
    await fireEvent.changeText(field(), 'Pai');
    const short = edits().overlays[0]!.scale;
    await fireEvent.changeText(field(), 'Pai, Mae Hong Son');
    expect(edits().overlays[0]!.scale).toBeGreaterThan(short * 2);
  });

  it('Use where I am fills in the town, which the user can then change', async () => {
    await render(<Harness lookUp={() => Promise.resolve({ kind: 'found', text: 'Baguio' })} />);
    await fireEvent.press(useCurrent());
    expect(edits().overlays).toMatchObject([{ type: 'place', text: 'Baguio' }]);
    expect(field().props.value).toBe('Baguio');
    await fireEvent.changeText(field(), 'Session Road, Baguio');
    expect(edits().overlays).toMatchObject([{ type: 'place', text: 'Session Road, Baguio' }]);
  });

  it('says so when location is off or the town isn’t found, and adds nothing', async () => {
    let result: PlaceLookup = { kind: 'denied' };
    await render(<Harness lookUp={() => Promise.resolve(result)} />);
    await fireEvent.press(useCurrent());
    expect(screen.getByRole('alert')).toHaveTextContent(/Location is off for Pickld/);
    result = { kind: 'failed' };
    await fireEvent.press(useCurrent());
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t find your town. Type the place instead.');
    expect(edits().overlays).toEqual([]);
  });

  it('a color applies to the selected place', async () => {
    await render(<Harness lookUp={never} />);
    await fireEvent.changeText(field(), 'Siargao');
    await act(() =>
      fireEvent.press(within(screen.getByTestId('place-colors')).getByRole('button', { name: 'Yellow' })),
    );
    expect(edits().overlays).toMatchObject([{ text: 'Siargao', color: 'butter' }]);
  });
});

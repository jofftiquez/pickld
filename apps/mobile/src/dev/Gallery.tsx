// Dev-only component gallery (M1-24). Every kit component in each state, for review against the
// Hi-fi A designs and for repeatable Maestro screenshots. Copy here is fixture data, not product copy.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { JarGraphic } from '@/components/JarGraphic';
import { ListRow } from '@/components/ListRow';
import { MomentTile } from '@/components/MomentTile';
import { PhotoTile } from '@/components/PhotoTile';
import { PillButton } from '@/components/PillButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { showToast } from '@/lib/toast';
import { textStyle } from '@/theme/text';
import { colors, lidColors, space } from '@/theme/tokens';

import { devPhotos } from './fixtures';
import { GallerySection } from './GallerySection';

const noop = () => {};
const row = { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' } as const;
const tileCell = { width: '47%' } as const;

export function Gallery() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('Dale David');
  const [bio, setBio] = useState('Coffee first, then everything else.');
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'readers' | 'everyone' | 'only_me'>('readers');
  const [chips, setChips] = useState<string[]>(['Barkada']);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const toggleChip = (c: string) => setChips((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <ScrollView
      testID="gallery-scroll"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: space.xl,
      }}
    >
      <Text style={[textStyle('screenTitle'), { color: colors.ink }]}>Component gallery</Text>

      <GallerySection id="buttons" title="Buttons">
        <PrimaryButton label="Publish jar" onPress={noop} />
        <PrimaryButton label="Publish jar (disabled)" onPress={noop} disabled />
        <SecondaryButton label="Not yet" onPress={noop} />
        <SecondaryButton label="Invite friends" variant="outline" onPress={noop} />
        <DangerButton label="Delete my account" onPress={noop} />
        <View style={row}>
          <PillButton label="Read" onPress={noop} />
          <PillButton label="Reading" variant="subtle" onPress={noop} />
          <RoundIconButton icon="myDays" accessibilityLabel="My days" onPress={noop} />
          <View style={{ backgroundColor: colors.ink, padding: space.sm, borderRadius: 999 }}>
            <RoundIconButton icon="close" variant="glass" accessibilityLabel="Close" onPress={noop} />
          </View>
        </View>
      </GallerySection>

      <GallerySection id="forms" title="Form controls">
        <TextField label="Name" value={name} onChangeText={setName} maxLength={40} />
        <TextField label="Bio" value={bio} onChangeText={setBio} maxLength={120} multiline />
        <View style={row}>
          <Toggle value={on} onValueChange={setOn} accessibilityLabel="Morning reminder" />
          <Toggle value={!on} onValueChange={(v) => setOn(!v)} accessibilityLabel="Evening reminder" />
          <Toggle value onValueChange={noop} accessibilityLabel="Disabled reminder" disabled />
        </View>
        <SegmentedControl
          accessibilityLabel="Who can see this jar"
          segments={[
            { key: 'readers', label: 'Readers' },
            { key: 'everyone', label: 'Everyone' },
            { key: 'only_me', label: 'Only me' },
          ]}
          selected={seg}
          onSelect={setSeg}
        />
        <View style={row}>
          {['Barkada', 'Family', 'Work', 'Pambahay'].map((c) => (
            <Chip key={c} label={c} selected={chips.includes(c)} onPress={() => toggleChip(c)} />
          ))}
        </View>
        <Card>
          <ListRow label="Default visibility" value="Readers" onPress={noop} divider />
          <ListRow label="Blocked accounts" value="2" onPress={noop} divider />
          <ListRow label="Delete account" tone="danger" onPress={noop} />
        </Card>
      </GallerySection>

      <GallerySection id="containers" title="Containers">
        <Card>
          <View style={row}>
            <Avatar name="Dale David" uri={devPhotos.dale} size="sm" />
            <Avatar name="Dale David" uri={devPhotos.dale} size="md" ring />
            <Avatar name="Mika Reyes" size="lg" />
            <Avatar name="Aya Lim" size="xl" />
          </View>
        </Card>
        <View style={row}>
          <PillButton label="Open bottom sheet" variant="subtle" onPress={() => setSheet(true)} />
          <PillButton label="Open dialog" variant="subtle" onPress={() => setDialog(true)} />
          <PillButton label="Show toast" variant="subtle" onPress={() => showToast('changesSaved')} />
        </View>
      </GallerySection>

      <GallerySection id="jar" title="Jar graphic">
        <View style={row}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
            <JarGraphic key={c} count={c} size={52} />
          ))}
        </View>
        <View style={row}>
          <JarGraphic count={5} size={14} />
          <JarGraphic count={5} size={22} />
          {Object.values(lidColors).map((l) => (
            <JarGraphic key={l} count={8} size={40} lidColor={l} />
          ))}
        </View>
        <View style={[row, { backgroundColor: colors.ink, borderRadius: 24, padding: space.xl }]}>
          <JarGraphic count={5} size={52} onDark />
          <JarGraphic count={8} size={52} onDark />
        </View>
      </GallerySection>

      <GallerySection id="tiles" title="Moment tiles">
        <View style={row}>
          <View style={tileCell}>
            <MomentTile slot="whereami" state="filled" uri={devPhotos.whereami} time="12:30 PM" onPress={noop} />
          </View>
          <View style={tileCell}>
            <MomentTile slot="whoamiwith" state="empty" onPress={noop} />
          </View>
          <View style={tileCell}>
            <MomentTile
              slot="ootd"
              state="filled"
              uri={devPhotos.ootd}
              time="7:30 AM"
              visibility="only_me"
              onPress={noop}
            />
          </View>
          <View style={tileCell}>
            <MomentTile slot="afternoon" state="now" onPress={noop} />
          </View>
          <View style={tileCell}>
            <MomentTile
              slot="morning"
              state="filled"
              uri={devPhotos.morning}
              time="6:48 AM"
              addedLater
              onPress={noop}
            />
          </View>
          <View style={tileCell}>
            <MomentTile slot="whereami" state="waiting" uri={devPhotos.whereami} time="12:30 PM" onPress={noop} />
          </View>
          <View style={tileCell}>
            <MomentTile
              slot="selfie"
              state="uploading"
              uri={devPhotos.selfie}
              time="11:05 AM"
              progress={0.6}
              onPress={noop}
            />
          </View>
          <View style={tileCell}>
            <MomentTile
              slot="morning"
              state="failed"
              uri={devPhotos.morning}
              time="6:48 AM"
              onPress={noop}
              onRetry={noop}
            />
          </View>
          <View style={tileCell}>
            <MomentTile slot="ootd" state="checking" uri={devPhotos.ootd} time="7:30 AM" onPress={noop} />
          </View>
          <View style={tileCell}>
            <PhotoTile uri={devPhotos.selfie} label="#selfie" />
          </View>
        </View>
      </GallerySection>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} accessibilityLabel="Moment options">
        <ListRow label="Edit caption" onPress={noop} divider />
        <ListRow label="Visibility" onPress={noop} divider />
        <ListRow label="Delete moment" tone="danger" onPress={() => setSheet(false)} />
      </BottomSheet>
      <Dialog
        visible={dialog}
        onClose={() => setDialog(false)}
        title="Block Mika?"
        message="Mika won't be able to see your jars or find your profile. We won't tell them."
        cancelLabel="Cancel"
      >
        <DangerButton label="Block" onPress={() => setDialog(false)} />
      </Dialog>
    </ScrollView>
  );
}

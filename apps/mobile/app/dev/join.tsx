import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MockCameraPreview } from '@/features/capture/MockCameraPreview';
import { JoinCodeCard, type JoinCode } from '@/features/invite/JoinCodeCard';
import { ScanView } from '@/features/invite/ScanView';
import { WaitingView, type WaitingError } from '@/features/invite/WaitingView';
import { AuthView } from '@/features/onboarding/AuthView';

const none: JoinCode = { state: 'none', error: null };
const cards: Record<string, JoinCode> = {
  none,
  error: { state: 'none', error: 'unavailable' },
  checking: { state: 'checking', token: 'K7M2QX' },
  invited: { state: 'invited', token: 'K7M2QX', inviter: { displayName: 'Mia Cruz', avatar: null } },
  ready: { state: 'ready', token: 'K7M2QX' },
};

// Dev builds only (like /dev/invite): the INV-06 screens from fixtures, no backend.
// pickld://dev/join?screen=signup&card=none|error|checking|invited|ready
// pickld://dev/join?screen=waiting&ahead=12&code=K7M&error=unavailable
// pickld://dev/join?screen=scan&notInvite=1 (or &denied=1)
type Params = {
  screen?: string;
  card?: string;
  ahead?: string;
  code?: string;
  error?: string;
  notInvite?: string;
  denied?: string;
};

export default function DevJoinRoute() {
  const params = useLocalSearchParams<Params>();
  if (!__DEV__) return <Redirect href="/" />;
  // Keyed so each preview URL starts fresh (the typed code and email are state).
  return <DevJoin key={JSON.stringify(params)} params={params} />;
}

function DevJoin({ params }: { params: Params }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(params.code ?? '');
  const noop = () => undefined;
  const back = () => router.back();

  if (params.screen === 'waiting') {
    return (
      <WaitingView
        insets={insets}
        ahead={params.ahead === undefined ? null : Number(params.ahead)}
        code={code}
        onChangeCode={setCode}
        error={(params.error as WaitingError | undefined) ?? null}
        busy={false}
        onPaste={noop}
        onScan={noop}
        onGetIn={noop}
        onSettings={noop}
      />
    );
  }
  if (params.screen === 'scan') {
    return (
      <ScanView
        insets={insets}
        preview={<MockCameraPreview facing="back" />}
        access={params.denied ? 'denied' : 'live'}
        notInvite={Boolean(params.notInvite)}
        torch={false}
        hasTorch
        onClose={back}
        onTorch={noop}
        onTypeInstead={back}
        onOpenSettings={noop}
      />
    );
  }
  const card = cards[params.card ?? 'none'] ?? none;
  return (
    <AuthView
      mode="signUp"
      insets={insets}
      email={email}
      onChangeEmail={setEmail}
      busy={false}
      error={null}
      onBack={back}
      onProvider={noop}
      onSubmitEmail={noop}
      onSwitchMode={noop}
      onLegal={noop}
      codeCard={<JoinCodeCard code={card} onPaste={noop} onScan={noop} />}
      showFan={card.state === 'none'}
    />
  );
}

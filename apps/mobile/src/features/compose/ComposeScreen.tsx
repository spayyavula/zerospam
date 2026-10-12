import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, Divider, ErrorState, Loading, Text } from '../../components/ui';
import { fetchReplyPrefill, useSend } from '../../hooks/useApi';
import { useMailboxStore } from '../../stores/mailboxStore';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';
import { validateRecipients } from '../../lib/validation';
import { errorText } from '../../lib/apiClient';
import { toast } from '../../lib/toast';
import FolderSheet from '../../components/FolderSheet';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Compose'>;

type Prefill = { inReplyTo: string | null; references: string | null; mailboxId: number | null };

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoFocus,
  right,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  keyboardType?: 'email-address' | 'default';
  autoFocus?: boolean;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 52, gap: space.sm }}>
        <Text variant="small" tone="quiet" style={{ width: 56 }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={keyboardType !== 'email-address'}
          accessibilityLabel={label}
          style={{ flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12 }}
          selectionColor={colors.accent}
        />
        {right}
      </View>
      <Divider inset={space.lg} />
    </>
  );
}

export default function ComposeScreen({ route, navigation }: Props) {
  const params = route.params ?? {};
  const { colors } = useTheme();
  const { mailboxes, activeMailboxId } = useMailboxStore();
  const send = useSend();

  const [loading, setLoading] = useState(!!(params.mode && params.messageId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [to, setTo] = useState(params.to ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [prefill, setPrefill] = useState<Prefill>({ inReplyTo: null, references: null, mailboxId: null });
  const [fromSheet, setFromSheet] = useState(false);
  const initial = useRef('');
  const sent = useRef(false);

  const mailboxId = prefill.mailboxId ?? activeMailboxId;
  const from = mailboxes.find((mb) => mb.id === mailboxId);

  useEffect(() => {
    if (!params.mode || !params.messageId) {
      initial.current = JSON.stringify([params.to ?? '', '', '', '', '']);
      return;
    }
    let cancelled = false;
    fetchReplyPrefill(params.messageId, params.mode)
      .then((p) => {
        if (cancelled) return;
        const toS = (p.to ?? []).join(', ');
        const ccS = (p.cc ?? []).join(', ');
        setTo(toS);
        setCc(ccS);
        setShowCc(!!ccS);
        setSubject(p.subject ?? '');
        setBody(p.text ?? '');
        setPrefill({ inReplyTo: p.inReplyTo ?? null, references: p.references ?? null, mailboxId: p.mailboxId });
        initial.current = JSON.stringify([toS, ccS, '', p.subject ?? '', p.text ?? '']);
      })
      .catch((e) => !cancelled && setLoadError(errorText(e, 'Could not load the original message.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [params.mode, params.messageId, params.to]);

  const dirty = () => JSON.stringify([to, cc, bcc, subject, body]) !== initial.current;

  // Confirm before throwing away a message.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (sent.current || loading || !dirty()) return;
        e.preventDefault();
        Alert.alert('Discard this message?', 'What you wrote will be lost.', [
          { text: 'Keep writing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigation, to, cc, bcc, subject, body, loading],
  );

  const onSend = () => {
    const v = validateRecipients(to, cc, bcc);
    if (!v.ok) {
      Alert.alert('Can’t send yet', v.error);
      return;
    }
    if (mailboxId == null) return;
    const go = () =>
      send.mutate(
        {
          mailboxId,
          to: v.to,
          cc: v.cc.length ? v.cc : undefined,
          bcc: v.bcc.length ? v.bcc : undefined,
          subject: subject.trim() || '(no subject)',
          text: body,
          inReplyTo: prefill.inReplyTo,
          references: prefill.references,
        },
        {
          onSuccess: () => {
            sent.current = true;
            toast('Sent');
            navigation.goBack();
          },
          onError: (e) => Alert.alert('Not sent', errorText(e, 'The message could not be sent. Try again.')),
        },
      );
    if (!subject.trim()) {
      Alert.alert('Send without a subject?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: go },
      ]);
    } else go();
  };

  const title = params.mode === 'forward' ? 'Forward' : params.mode ? 'Reply' : 'New message';

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () => (
        <Button
          title="Send"
          icon="send"
          loading={send.isPending}
          disabled={loading || !!loadError}
          onPress={onSend}
          style={{ minHeight: 38, paddingHorizontal: 14 }}
        />
      ),
    });
  });

  if (loading) return <Loading />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => navigation.goBack()} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <Pressable
          onPress={() => mailboxes.length > 1 && !prefill.mailboxId && setFromSheet(true)}
          disabled={mailboxes.length <= 1 || !!prefill.mailboxId}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 52, gap: space.sm }}
          accessibilityRole="button"
          accessibilityLabel={`From ${from?.address ?? ''}`}
        >
          <Text variant="small" tone="quiet" style={{ width: 56 }}>From</Text>
          <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{from?.address ?? '—'}</Text>
          {mailboxes.length > 1 && !prefill.mailboxId ? <Ionicons name="chevron-down" size={16} color={colors.quiet} /> : null}
        </Pressable>
        <Divider inset={space.lg} />
        <Field
          label="To"
          value={to}
          onChangeText={setTo}
          keyboardType="email-address"
          autoFocus={!params.mode && !params.to}
          right={
            !showCc ? (
              <Pressable onPress={() => setShowCc(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add Cc and Bcc">
                <Text variant="small" tone="accent">Cc/Bcc</Text>
              </Pressable>
            ) : null
          }
        />
        {showCc ? (
          <>
            <Field label="Cc" value={cc} onChangeText={setCc} keyboardType="email-address" />
            <Field label="Bcc" value={bcc} onChangeText={setBcc} keyboardType="email-address" />
          </>
        ) : null}
        <Field label="Subject" value={subject} onChangeText={setSubject} />
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          autoFocus={!!params.mode && params.mode !== 'forward'}
          placeholder="Write your message"
          placeholderTextColor={colors.quiet}
          selectionColor={colors.accent}
          textAlignVertical="top"
          accessibilityLabel="Message"
          // Put the cursor above the quoted text when replying.
          selection={params.mode && params.mode !== 'forward' && !dirty() ? { start: 0, end: 0 } : undefined}
          style={{ flex: 1, minHeight: 240, padding: space.lg, fontSize: 16, lineHeight: 23, color: colors.ink }}
        />
      </ScrollView>
      <FolderSheet visible={fromSheet} onClose={() => setFromSheet(false)} showFolders={false} />
    </KeyboardAvoidingView>
  );
}

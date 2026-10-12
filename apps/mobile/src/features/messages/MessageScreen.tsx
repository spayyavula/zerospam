import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { Attachment, MessageDetail } from '@zerospam/shared-api';
import MessageBody from './MessageBody';
import { Button, Chip, Divider, ErrorState, IconButton, Loading, Text } from '../../components/ui';
import {
  useAttachments,
  useDeleteForever,
  useMessage,
  useMove,
  useRemoteImages,
  useSetRead,
  useSetStar,
  useTrustSender,
} from '../../hooks/useApi';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, space } from '../../theme/tokens';
import { bytes, expiresIn, initials, longDate, parseAddressList, senderLabel } from '../../lib/format';
import { hasRemoteImages } from '../../lib/messageHtml';
import { errorText } from '../../lib/apiClient';
import { openAttachment } from '../../lib/attachments';
import { toast } from '../../lib/toast';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Message'>;

function AuthChips({ m }: { m: MessageDetail }) {
  const chip = (label: string, v: number | null) =>
    v == null ? null : <Chip key={label} label={`${label} ${v ? '✓' : '✗'}`} tone={v ? 'ok' : 'danger'} />;
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {chip('SPF', m.spf_pass)}
      {chip('DKIM', m.dkim_pass)}
      {chip('DMARC', m.dmarc_pass)}
    </View>
  );
}

function AttachmentRow({ a }: { a: Attachment }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        setBusy(true);
        try {
          await openAttachment(a);
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Could not open the attachment');
        } finally {
          setBusy(false);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open attachment ${a.filename ?? ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        borderWidth: 1,
        borderColor: colors.rule,
        borderRadius: radius.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        backgroundColor: pressed ? colors.paperDeep : colors.paper,
        maxWidth: 260,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="document-attach-outline" size={18} color={colors.inkSoft} />}
      <View style={{ flexShrink: 1 }}>
        <Text variant="small" numberOfLines={1}>{a.filename ?? 'Attachment'}</Text>
        <Text variant="caption" tone="quiet">{bytes(a.size_bytes)}</Text>
      </View>
    </Pressable>
  );
}

export default function MessageScreen({ route, navigation }: Props) {
  const { messageId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useMessage(messageId);
  const m = q.data;
  const atts = useAttachments(messageId, (m?.attachment_count ?? 0) > 0);
  const setRead = useSetRead();
  const setStar = useSetStar();
  const move = useMove();
  const del = useDeleteForever();
  const trust = useTrustSender();
  const remote = useRemoteImages();
  const [images, setImages] = useState<Record<string, string> | null>(null);
  const [asText, setAsText] = useState(false);
  const [details, setDetails] = useState(false);
  const markedRead = useRef(false);

  // Opening a message marks it read (once).
  useEffect(() => {
    if (m && !m.read && m.folder !== 'sent' && !markedRead.current) {
      markedRead.current = true;
      setRead.mutate({ id: m.id, mailboxId: m.mailbox_id, read: true });
    }
  }, [m, setRead]);

  const ref = m ? { id: m.id, mailboxId: m.mailbox_id } : null;
  const fail = (e: unknown) => toast(errorText(e));

  useLayoutEffect(() => {
    if (!m || !ref) return;
    const trashOrDelete =
      m.folder === 'trash' || m.folder === 'quarantine' ? (
        <IconButton
          name="close-circle-outline"
          label="Delete forever"
          onPress={() =>
            Alert.alert('Delete forever?', 'This message will be permanently removed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => del.mutate(ref, { onSuccess: () => { toast('Deleted'); navigation.goBack(); }, onError: fail }),
              },
            ])
          }
        />
      ) : (
        <IconButton
          name="trash-outline"
          label="Move to Trash"
          onPress={() => move.mutate({ ...ref, folder: 'trash' }, { onSuccess: () => { toast('Moved to Trash'); navigation.goBack(); }, onError: fail })}
        />
      );
    navigation.setOptions({
      headerTitle: '',
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          {m.folder === 'trash' ? (
            <IconButton
              name="arrow-undo-outline"
              label="Move to Inbox"
              onPress={() => move.mutate({ ...ref, folder: 'inbox' }, { onSuccess: () => toast('Moved to Inbox'), onError: fail })}
            />
          ) : null}
          <IconButton
            name={m.starred ? 'star' : 'star-outline'}
            color={m.starred ? colors.signal : undefined}
            label={m.starred ? 'Remove star' : 'Star'}
            onPress={() => setStar.mutate({ ...ref, starred: !m.starred }, { onError: fail })}
          />
          {m.folder !== 'sent' ? (
            <IconButton
              name="mail-unread-outline"
              label="Mark as unread"
              onPress={() => setRead.mutate({ ...ref, read: false }, { onSuccess: () => navigation.goBack(), onError: fail })}
            />
          ) : null}
          {trashOrDelete}
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, m, colors.signal]);

  if (q.isPending) return <Loading />;
  if (q.isError || !m) return <ErrorState message={errorText(q.error, 'Could not load this message.')} onRetry={() => void q.refetch()} />;

  const to = parseAddressList(m.to_addresses);
  const cc = parseAddressList(m.cc_addresses);
  const canShowImages = !!m.body_html && !asText && hasRemoteImages(m.body_html) && !images;
  const label = senderLabel(m);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flexGrow: 0, maxHeight: '45%' }} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Text variant="title" selectable>{m.subject?.trim() || '(no subject)'}</Text>

        <Pressable onPress={() => setDetails((v) => !v)} accessibilityRole="button" accessibilityLabel="Show details" style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paperDeep, borderWidth: 1, borderColor: colors.rule, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 16 }}>{initials(label)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>{label}</Text>
            <Text variant="caption" tone="quiet" numberOfLines={1}>
              {m.from_name ? `${m.from_address} · ` : ''}{longDate(m.received_at)}
            </Text>
          </View>
          <Ionicons name={details ? 'chevron-up' : 'chevron-down'} size={16} color={colors.quiet} />
        </Pressable>

        {details ? (
          <View style={{ gap: 4 }}>
            <Text variant="small" tone="soft" selectable>To: {to.join(', ') || '—'}</Text>
            {cc.length ? <Text variant="small" tone="soft" selectable>Cc: {cc.join(', ')}</Text> : null}
            {m.delivered_to_alias ? <Text variant="small" tone="soft" selectable>Via alias: {m.delivered_to_alias}</Text> : null}
            <AuthChips m={m} />
          </View>
        ) : m.delivered_to_alias ? (
          <Text variant="caption" tone="quiet">Via alias {m.delivered_to_alias}</Text>
        ) : null}

        {m.folder === 'quarantine' ? (
          <View style={{ backgroundColor: colors.paperDeep, borderRadius: radius.sm, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.rule }}>
            <Text variant="small" tone="soft">
              In quarantine{m.expires_at ? ` · deleted ${expiresIn(m.expires_at)}` : ''}. You haven{'’'}t approved this sender.
            </Text>
            <Button
              title={`Trust ${m.from_address}`}
              icon="checkmark-circle-outline"
              loading={trust.isPending}
              onPress={() => trust.mutate({ id: m.id, mailboxId: m.mailbox_id }, { onSuccess: () => toast('Sender trusted · moved to Inbox'), onError: fail })}
            />
          </View>
        ) : null}

        {atts.data && atts.data.filter((a) => !a.inline).length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {atts.data.filter((a) => !a.inline).map((a) => <AttachmentRow key={a.id} a={a} />)}
          </View>
        ) : null}

        {canShowImages || (m.body_html && m.body_text) ? (
          <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
            {canShowImages ? (
              <Pressable
                onPress={() => remote.mutate(m.id, { onSuccess: (r) => setImages(r.map), onError: fail })}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                {remote.isPending ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="image-outline" size={16} color={colors.accent} />}
                <Text variant="small" tone="accent" style={{ fontWeight: '600' }}>Show images</Text>
              </Pressable>
            ) : null}
            {m.body_html && m.body_text ? (
              <Pressable onPress={() => setAsText((v) => !v)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={asText ? 'code-slash-outline' : 'text-outline'} size={16} color={colors.accent} />
                <Text variant="small" tone="accent" style={{ fontWeight: '600' }}>{asText ? 'Show formatted' : 'Show as text'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <Divider />

      <MessageBody
        html={asText ? null : m.body_html}
        text={m.body_text}
        images={images}
        onMailto={(address) => navigation.navigate('Compose', { to: address })}
      />

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
          borderTopWidth: 1,
          borderTopColor: colors.rule,
          backgroundColor: colors.paper,
        }}
      >
        <Button style={{ flex: 1 }} kind="secondary" icon="arrow-undo-outline" title="Reply" onPress={() => navigation.navigate('Compose', { mode: 'reply', messageId: m.id })} />
        {to.length + cc.length > 1 ? (
          <Button style={{ flex: 1 }} kind="secondary" icon="arrow-undo-circle-outline" title="All" onPress={() => navigation.navigate('Compose', { mode: 'reply-all', messageId: m.id })} />
        ) : null}
        <Button style={{ flex: 1 }} kind="secondary" icon="arrow-redo-outline" title="Forward" onPress={() => navigation.navigate('Compose', { mode: 'forward', messageId: m.id })} />
      </View>
    </View>
  );
}

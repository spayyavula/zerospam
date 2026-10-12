import React, { useEffect, useState } from 'react';
import { Linking, Switch } from 'react-native';
import { Divider, Row, SectionHeader, Text } from '../../components/ui';
import { disablePush, enablePush, getPushSettings, pushSupported, setPushPreview, type PushSettings } from '../../lib/push';
import { setPref } from '../../lib/prefs';
import { errorText } from '../../lib/apiClient';
import { toast } from '../../lib/toast';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

export default function NotificationSettings() {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    getPushSettings().then(setSettings).catch(() => setSettings({ enabled: false, showPreview: true }));
  }, []);

  if (!pushSupported()) return null;

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const r = await enablePush(settings?.showPreview);
        if (r === 'denied') {
          toast('Notifications are blocked for ZeroSpam in Android settings');
          void Linking.openSettings();
        } else if (r === 'unsupported') {
          toast('Notifications aren’t available in this build');
        } else {
          setSettings(r);
          await setPref('push_off', '0');
        }
      } else {
        setSettings(await disablePush());
        await setPref('push_off', '1');
      }
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const switchColors = { trackColor: { false: colors.rule, true: colors.signal }, thumbColor: colors.paper };

  return (
    <>
      <SectionHeader title="Notifications" />
      <Row
        icon="notifications-outline"
        title="New mail"
        subtitle="Only for mail that reaches your Inbox. Screener and Quarantine stay quiet."
        right={<Switch value={!!settings?.enabled} disabled={busy || !settings} onValueChange={toggle} {...switchColors} accessibilityLabel="New mail notifications" />}
      />
      {settings?.enabled ? (
        <>
          <Divider inset={52} />
          <Row
            icon="eye-outline"
            title="Show sender and subject"
            subtitle={settings.showPreview ? 'Shown on your lock screen when the phone allows it.' : 'Notifications only say “New message”.'}
            right={
              <Switch
                value={settings.showPreview}
                disabled={busy}
                accessibilityLabel="Show sender and subject"
                onValueChange={async (v) => {
                  setBusy(true);
                  try {
                    setSettings(await setPushPreview(v));
                  } catch (e) {
                    toast(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                {...switchColors}
              />
            }
          />
        </>
      ) : null}
      <Text variant="caption" tone="quiet" style={{ paddingHorizontal: space.lg, paddingTop: space.xs }}>
        Applies to this phone only.
      </Text>
    </>
  );
}

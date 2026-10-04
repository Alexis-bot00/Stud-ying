import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Planner, reminderDates } from './cappy-model';

let pending = Promise.resolve('');
const channelId = 'cappy-classes';
async function prepareNotifications() {
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  // Preserve the sound the user selected in Android's notification settings.
  if (Platform.OS === 'android' && !await Notifications.getNotificationChannelAsync(channelId)) {
    await Notifications.setNotificationChannelAsync(channelId, { name: 'Cappy class reminders', importance: Notifications.AndroidImportance.HIGH, sound: 'default', enableVibrate: true, vibrationPattern: [0, 250, 150, 250] });
  }
  return Notifications;
}
export async function chooseReminderSound() {
  if (Platform.OS !== 'android') return 'Reminder sounds use your device notification settings.';
  await prepareNotifications();
  const packageName = Constants.appOwnership === 'expo' ? 'host.exp.exponent' : Constants.expoConfig?.android?.package;
  if (!packageName) throw new Error('App package unavailable');
  try {
    await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: packageName },
      { key: 'android.provider.extra.CHANNEL_ID', value: channelId },
    ]);
  } catch { await Linking.openSettings(); }
  return 'Choose Sound in Cappy class reminders, then return here. Your phone saves the sound automatically.';
}
export async function testReminder() {
  if (Platform.OS === 'web') return 'Sound reminders work in the Android or iOS app, not this browser preview.';
  const Notifications = await prepareNotifications();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'Allow notifications in device settings to hear reminders.';
  await Notifications.scheduleNotificationAsync({ identifier: 'cappy-sound-test', content: { title: 'Cappy’s class reminder', body: 'This is how your class reminder will sound.', sound: 'default' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId } });
  return 'Test reminder arriving in 5 seconds. It uses your chosen notification sound.';
}
export function syncReminders(planner: Planner) {
  pending = pending.catch(() => '').then(() => applyReminders(planner));
  return pending;
}
async function applyReminders(planner: Planner) {
  if (Platform.OS === 'web') return 'Class reminders are available in the Android or iOS app.';
  const Notifications = await prepareNotifications();
  let permission = await Notifications.getPermissionsAsync();
  if ((planner.notifyAt || planner.notifyBefore) && !permission.granted) permission = await Notifications.requestPermissionsAsync();
  const old = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of old.filter(n => n.content.data?.cappy === true)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
  if (!planner.notifyAt && !planner.notifyBefore) return 'Class reminders are off.';
  if (!permission.granted) return 'Reminders are off because notification permission was not granted. Enable notifications in device settings.';
  const upcoming = reminderDates(planner.classes, planner).slice(0, 60);
  for (const item of upcoming) {
    await Notifications.scheduleNotificationAsync({ identifier: `cappy-${item.id}`, content: { title: 'Cappy’s class reminder', body: item.title, data: { cappy: true }, sound: 'default' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId } });
  }
  return upcoming.length ? `Reminders applied. Next: ${upcoming[0].title}, ${upcoming[0].date.toLocaleString()}. Open Cappy regularly to refresh upcoming reminders.` : 'Add a class to your schedule to receive reminders.';
}

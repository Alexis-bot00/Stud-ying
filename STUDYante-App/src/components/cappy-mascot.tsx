import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, Text, View } from 'react-native';

export type CappyMood = 'wave' | 'dance' | 'sleep' | 'read' | 'celebrate' | 'sad' | 'cute';
const art = {
  wave: require('../../assets/images/cappy-mascot.png'),
  dance: require('../../assets/images/cappy-dance.png'),
  sleep: require('../../assets/images/cappy-sleep.png'),
  read: require('../../assets/images/cappy-read.png'),
  celebrate: require('../../assets/images/cappy-dance.png'),
  sad: require('../../assets/images/cappy-sad.png'),
  cute: require('../../assets/images/cappy-cute.png'),
};
const messages: Record<CappyMood, string> = { wave: 'You’ve got this! ✦', dance: 'Tiny victory dance! ♫', sleep: 'Rest counts, too. ☾', read: 'One page at a time. ♡', celebrate: 'Look at you go! ✦', sad: 'A little cheer helps. ♡', cute: 'Who, me? Cute? ♡' };

export function useAutomaticCappyMood() {
  const [mood, setMood] = useState<CappyMood>('wave');
  useEffect(() => {
    const moods: CappyMood[] = ['wave', 'read', 'dance', 'sleep', 'celebrate', 'cute', 'sad'];
    const timer = setInterval(() => {
      if (Platform.OS === 'web' ? typeof document !== 'undefined' && document.hidden : AppState.currentState !== 'active') return;
      setMood(moods[(moods.indexOf(mood) + 1) % moods.length]);
    }, 12000);
    return () => clearInterval(timer);
  }, [mood]);
  return { mood, setMood };
}

export function CappyMascot({ size = 100, mood: givenMood, onHello, onMoodChange }: { size?: number; mood?: CappyMood; onHello?: () => void; onMoodChange?: (mood: CappyMood) => void }) {
  const automatic = useAutomaticCappyMood();
  const [cheered, setCheered] = useState(false);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mood = cheered ? 'celebrate' : givenMood || automatic.mood;
  const phase = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active' || Platform.OS === 'web');
  const [hello, setHello] = useState<string | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { live = false; preference.remove(); app.remove(); hop.stopAnimation(); if (hide.current) clearTimeout(hide.current); if (cheerTimer.current) clearTimeout(cheerTimer.current); };
  }, [hop]);
  useEffect(() => {
    phase.stopAnimation(); phase.setValue(0); hop.stopAnimation(); hop.setValue(0);
    if (reduced || !active) return;
    const duration = mood === 'dance' ? 700 : mood === 'celebrate' ? 900 : mood === 'sleep' ? 2800 : mood === 'sad' ? 2400 : mood === 'cute' ? 1400 : mood === 'read' ? 2100 : 1700;
    const config = { duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const loop = Animated.loop(Animated.sequence([Animated.timing(phase, { ...config, toValue: 1 }), Animated.timing(phase, { ...config, toValue: 0 })]));
    loop.start(); return () => loop.stop();
  }, [mood, active, reduced, phase, hop]);
  const dancing = mood === 'dance';
  const y = mood === 'celebrate' ? [0, -13, 0, -8, 0] : mood === 'sad' ? [0, 1, 2, 1, 0] : mood === 'cute' ? [0, -2, -4, -2, 0] : dancing ? [0, -5, 0, -5, 0] : mood === 'sleep' ? [0, -1, -2, -1, 0] : mood === 'read' ? [0, -1, -3, -1, 0] : [2, 0, -5, 0, 2];
  const rotation = dancing ? ['-9deg', '0deg', '9deg', '0deg', '-9deg'] : mood === 'cute' ? ['-6deg', '-2deg', '6deg', '-2deg', '-6deg'] : mood === 'sad' || mood === 'read' ? ['-1deg', '0deg', '1deg', '0deg', '-1deg'] : mood === 'sleep' ? ['0deg', '0deg', '0deg', '0deg', '0deg'] : ['-2deg', '0deg', '2deg', '0deg', '-2deg'];
  const range = [0, 0.25, 0.5, 0.75, 1];
  return <Pressable accessibilityRole="button" accessibilityLabel={mood === 'sad' ? 'Cheer Cappy up' : 'Say hello to Cappy'} accessibilityHint={`Cappy is ${mood === 'sad' ? 'sad. Tap to make Cappy happy' : mood === 'cute' ? 'trying to look cute' : mood === 'sleep' ? 'sleeping' : mood === 'read' ? 'reading' : mood === 'dance' ? 'dancing' : mood === 'celebrate' ? 'celebrating' : 'waving'}`} onPress={() => {
    if (mood === 'sad') { setCheered(true); automatic.setMood('celebrate'); onMoodChange?.('celebrate'); if (cheerTimer.current) clearTimeout(cheerTimer.current); cheerTimer.current = setTimeout(() => setCheered(false), 10000); }
    setHello(mood === 'sad' ? 'You made my day! ♡' : messages[mood]); onHello?.(); if (hide.current) clearTimeout(hide.current); hide.current = setTimeout(() => setHello(null), 3000);
    if (!reduced && active && mood !== 'sleep') Animated.sequence([Animated.timing(hop, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }), Animated.spring(hop, { toValue: 0, friction: 4, useNativeDriver: Platform.OS !== 'web' })]).start();
  }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.Image accessibilityLabel="Cappy the capybara study buddy" source={art[mood]} style={{ width: size, height: size, transform: [
      { translateY: Animated.add(phase.interpolate({ inputRange: range, outputRange: y }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -12] })) },
      { translateX: phase.interpolate({ inputRange: range, outputRange: dancing ? [-4, 0, 4, 0, -4] : [0, 0, 0, 0, 0] }) },
      { rotate: phase.interpolate({ inputRange: range, outputRange: rotation }) },
      { scale: Animated.multiply(phase.interpolate({ inputRange: [0, 1], outputRange: mood === 'sleep' ? [1, 1.035] : [1, 1.012] }), hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] })) },
    ] }} resizeMode="contain" />
    {mood !== 'wave' && <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 1, right: 3, opacity: reduced ? 1 : phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.5] }), transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -6] }) }] }}><Text style={{ fontSize: Math.max(14, size / 7), color: mood === 'sleep' ? '#B4A6EA' : '#F5C864', fontWeight: '800' }}>{mood === 'sad' ? '⋯' : mood === 'sleep' ? 'z Z' : mood === 'read' ? '✧' : mood === 'dance' ? '♫ ♪' : '✦ ♡'}</Text></Animated.View>}
    {mood === 'sad' && !hello && <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, borderRadius: 10, padding: 4, backgroundColor: '#FFF0CE' }}><Text style={{ fontSize: 10, color: '#594338', textAlign: 'center' }}>Tap to cheer Cappy up ♡</Text></View>}
    {hello && <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#FFF0CE', padding: 6, borderRadius: 12 }}><Text accessibilityLiveRegion="polite" style={{ fontSize: 11, color: '#4A3A54' }}>{hello}</Text></View>}
  </Pressable>;
}

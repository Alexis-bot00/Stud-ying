import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { CircleCapybara } from './circle-capybara';
const materials = [
  { type: 'notes', icon: '📒', label: 'Notes', color: '#F5DCA2', hint: 'Gather your ideas' },
  { type: 'flashcards', icon: '🃏', label: 'Flashcards', color: '#D9E8D7', hint: 'Flip & remember' },
  { type: 'tests', icon: '📝', label: 'Tests', color: '#F8E9D9', hint: 'Try what you know' },
  { type: 'games', icon: '🧩', label: 'Games', color: '#E6DCF0', hint: 'A little friendly fun' },
];

/** A visual seat limit keeps the room comfortable; every member stays in the roster. */
export function CircleRoomScene({ room, members, p, dark, onOpen, onChat, onMembers }: any) {
  const [sceneWidth, setSceneWidth] = useState(300);
  const [now,setNow] = useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),250);return ()=>clearInterval(timer);},[]);
  const wide = sceneWidth >= 560;
  const seats = members.slice(0, wide ? 6 : 4);
  const top = Math.ceil(seats.length / 2);
  const latest = new Map<string,any>();
  for (const message of room.messages) { const time=Date.parse(message.createdAt);if(time<=now && now-time<10000 && seats.some((m:any)=>m.userId===message.senderUserId)) latest.set(message.senderUserId,message); }
  const visible = new Set([...latest.values()].sort((a:any,b:any)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,2).map((m:any)=>m.senderUserId));
  const seat = (member: any) => {
    const speech: any = latest.get(member.userId);
    const showSpeech = speech && visible.has(member.userId);
    return (
      <Pressable key={member.userId} accessibilityRole="button"
        accessibilityLabel={'Open Circle chat with ' + member.name} onPress={onChat}
        style={({ pressed }) => ({ width: wide ? '30%' : '47%', alignItems: 'center', padding: 4, opacity: pressed ? 0.75 : 1 })}>
        <View style={{width:'100%',minHeight:12,alignItems:'center',justifyContent:'flex-end',marginBottom:6}}>
          {showSpeech && <View testID={'circle-bubble-'+member.userId} style={{alignSelf:'center',maxWidth:'100%',borderRadius:17,backgroundColor:p.white,borderWidth:1,borderColor:p.line,overflow:'hidden',opacity:Math.min(1,(10000-(now-Date.parse(speech.createdAt)))/1000)}}><ScrollView nestedScrollEnabled style={{maxHeight:150,flexGrow:0}} contentContainerStyle={{paddingHorizontal:12,paddingVertical:9}}><Text style={{color:p.ink,fontSize:12,lineHeight:18,flexShrink:1,...(Platform.OS==='web'?{overflowWrap:'anywhere'} as any:{})}}>{speech.message}</Text></ScrollView></View>}
        </View>
        <CircleCapybara value={member.capybara} name={member.name} online={member.online || member.userId===room.currentUserId} />
        <Text style={{color:p.muted,fontSize:10,marginTop:3}}>{member.online || member.userId===room.currentUserId?'Studying':'Sleeping'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 4, marginTop: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: member.online ? '#6B9158' : '#A0988C' }} />
          <Text numberOfLines={1} style={{ flexShrink: 1, color: p.navy, fontWeight: '700', fontSize: 12 }}>{member.name}{member.userId === room.currentUserId ? ' (you)' : ''}</Text>
        </View>
        <Text style={{ color: member.role === 'creator' ? p.blue : p.muted, fontSize: 10, marginTop: 3, minHeight: 14 }}>{member.role === 'creator' ? '👑 Creator' : 'Study buddy'}</Text>
      </Pressable>
    );
  };
  return (
    <View onLayout={event => setSceneWidth(event.nativeEvent.layout.width)} style={{ backgroundColor: dark ? '#3D3025' : '#F5EBDD', borderRadius: 28, borderWidth: 1, borderColor: p.line, padding: wide ? 22 : 12, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 80, left: '5%', right: '5%', bottom: 28, backgroundColor: dark ? '#49392C' : '#EDE0CD', borderRadius: 140, borderWidth: 2, borderColor: dark ? '#594434' : '#E4D4BA' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <Text style={{ fontSize: 24 }}>🪴</Text><View style={{ alignItems: 'center', flex: 1 }}><Text style={{ color: p.navy, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>A LITTLE ROOM TO GROW</Text><Text style={{ color: p.muted, fontSize: 11, marginTop: 4 }}>Your people. Your pace.</Text></View><Text style={{ fontSize: 24 }}>☕</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems:'flex-end', gap: 4 }}>{seats.slice(0, top).map(seat)}</View>
      <View style={{ marginVertical: 12, padding: wide ? 22 : 16, borderRadius: wide ? 100 : 56, borderWidth: 4, borderColor: dark ? '#9A7452' : '#BA8E62', backgroundColor: dark ? '#78563A' : '#DFC09A', borderBottomWidth: 9 }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 8, right: 8, left: 8, bottom: 8, borderRadius: 70, borderWidth: 1, borderColor: dark ? '#98724E' : '#ECCFA8' }} />
        <Text style={{ textAlign: 'center', color: dark ? '#FFF3DE' : '#594338', fontWeight: '800', fontSize: 10, letterSpacing: 2, marginBottom: 16 }}>OUR STUDY TABLE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: wide ? 16 : 12 }}>
          {materials.map((material, index) => {
            const count = room.materials.filter((m: any) => m.materialType === material.type).length;
            return <Pressable key={material.type} accessibilityRole="button" accessibilityLabel={'Open shared ' + material.type} onPress={() => onOpen(material.type)}
              style={({ pressed }) => ({ width: wide ? '20%' : '43%', minHeight: wide ? 118 : 104, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: material.type === 'games' ? 26 : 9, backgroundColor: material.color, borderWidth: 1, borderColor: '#B48D67', borderLeftWidth: material.type === 'notes' ? 6 : 1, borderBottomWidth: 3, transform: [{ rotate: (pressed ? 0 : index % 2 ? 4 : -4) + 'deg' }, { scale: pressed ? 0.96 : 1 }] })}>
              {material.type === 'flashcards' && <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 5, borderRadius: 6, borderWidth: 1, borderColor: '#AEBDA9', transform: [{ rotate: '-4deg' }] }} />}
              <Text style={{ fontSize: wide ? 32 : 28 }}>{material.icon}</Text><Text style={{ color: '#594338', fontWeight: '800', fontSize: 12, marginTop: 4 }}>{material.label}</Text><Text style={{ color: '#705D49', fontSize: 10, marginTop: 4 }}>{count} shared</Text>
            </Pressable>;
          })}
        </View>
        <Text style={{ color: dark ? '#F2E2CD' : '#71563C', textAlign: 'center', fontSize: 10, marginTop: 16 }}>Pick something from the table. Learn a little together.</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', gap: 4 }}>{seats.slice(top).map(seat)}</View>
      {room.memberCount > seats.length && <Pressable accessibilityRole="button" accessibilityLabel={'+' + (room.memberCount - seats.length) + ' Members'} onPress={onMembers} style={{ alignSelf: 'center', marginTop: 14, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, backgroundColor: p.white, borderWidth: 1, borderColor: p.line }}><Text style={{ color: p.blue, fontWeight: '700', fontSize: 12 }}>+{room.memberCount - seats.length} Members · see everyone</Text></Pressable>}
    </View>
  );
}

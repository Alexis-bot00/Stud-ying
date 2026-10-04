import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

export const jacketColors: Record<string,string> = { blue:'#4879C6',green:'#367C47',pink:'#E989B0',orange:'#E9963C',yellow:'#F3CF46',red:'#C84F48',black:'#33343B' };
const art:Record<string,{read:any;sleep:any}> = {
  blue:{read:require('../../assets/images/cappy-read.png'),sleep:require('../../assets/images/cappy-sleep.png')},
  green:{read:require('../../assets/images/circle-green-read.png'),sleep:require('../../assets/images/circle-green-sleep.png')},
  pink:{read:require('../../assets/images/circle-pink-read.png'),sleep:require('../../assets/images/circle-pink-sleep.png')},
  orange:{read:require('../../assets/images/circle-orange-read.png'),sleep:require('../../assets/images/circle-orange-sleep.png')},
  yellow:{read:require('../../assets/images/circle-yellow-read.png'),sleep:require('../../assets/images/circle-yellow-sleep.png')},
  red:{read:require('../../assets/images/circle-red-read.png'),sleep:require('../../assets/images/circle-red-sleep.png')},
  black:{read:require('../../assets/images/circle-black-read.png'),sleep:require('../../assets/images/circle-black-sleep.png')},
};
export function CircleCapybara({ value = {}, name, size = 92, online = true }: any) {
  const color=art[value.jacketColor]?value.jacketColor:'blue';
  return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
    <Image source={art[color][online?'read':'sleep']} accessibilityLabel={'Capybara for '+name+' - '+(online?'Studying':'Sleeping')+' - '+color+' jacket'} resizeMode="contain" style={{width:size,height:size}}/>
  </View>;
}
export function CircleCapybaraEditor({ value, p, busy, error, onSave, onCancel }:any) {
  const [color,setColor]=useState(art[value?.jacketColor]?value.jacketColor:'blue');
  return <View style={{padding:18,marginVertical:12,borderRadius:22,borderWidth:1,borderColor:p.line,backgroundColor:p.white}}>
    <Text style={{color:p.navy,fontSize:20,fontWeight:'800'}}>Your Circle capybara</Text>
    <View style={{alignItems:'center',marginVertical:12}}><CircleCapybara value={{jacketColor:color}} name="you" size={150}/></View>
    <Text style={{color:p.ink,fontWeight:'700'}}>Choose your jacket</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:16}}>{Object.entries(jacketColors).map(([id,hex])=><Pressable key={id} accessibilityRole="radio" accessibilityLabel={id[0].toUpperCase()+id.slice(1)} accessibilityState={{checked:color===id}} disabled={busy} onPress={()=>setColor(id)} style={{width:'30%',flexGrow:1,alignItems:'center',padding:12,minHeight:44,borderRadius:16,borderWidth:2,borderColor:color===id?p.blue:p.line,backgroundColor:color===id?p.softBlue:p.white}}><View style={{width:28,height:28,borderRadius:14,backgroundColor:hex,marginBottom:8}}/><Text style={{color:p.ink,fontWeight:color===id?'800':'400'}}>{id[0].toUpperCase()+id.slice(1)}</Text></Pressable>)}</View>
    <Text style={{color:p.muted,lineHeight:22}}>Studies when you are online. Sleeps when you are offline.</Text>
    {!!error && <Text accessibilityLiveRegion="polite" style={{color:'#B45D49',marginTop:12}}>{error}</Text>}
    <View style={{flexDirection:'row',gap:12,marginTop:14}}>{[['Save my capybara',()=>onSave({jacketColor:color})],['Cancel',onCancel]].map(([label,fn]:any)=><Pressable key={label} accessibilityRole="button" disabled={busy} onPress={fn} style={{flex:1,padding:14,minHeight:44,borderRadius:14,backgroundColor:p.softBlue,opacity:busy?.5:1}}><Text style={{color:p.ink,textAlign:'center',fontWeight:'700'}}>{label}</Text></Pressable>)}</View>
  </View>;
}

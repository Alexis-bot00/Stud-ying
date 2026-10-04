import React from 'react';
import { Text, View } from 'react-native';

function inline(text:string,p:any) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>
    <Text key={i} style={part.startsWith('**')?{fontWeight:'700'}:part.startsWith('`')?{backgroundColor:p.bg,fontFamily:'monospace'}:undefined}>
      {part.startsWith('**')?part.slice(2,-2):part.startsWith('`')?part.slice(1,-1):part}
    </Text>);
}
export function CircleNoteReader({text,p}:any) {
  let code=false;
  return <View style={{marginTop:20,gap:7,maxWidth:760}}>{String(text).split('\n').map((line,i)=>{
    if(line.trim().startsWith('```')){code=!code;return null;}
    if(/^\s*([-*_])\1{2,}\s*$/.test(line))return <View key={i} style={{height:1,backgroundColor:p.line,marginVertical:12}}/>;
    const heading=!code && line.match(/^\s*(#{1,6})\s+(.+)$/);
    const bullet=!code && line.match(/^\s*[-*+]\s+(.+)$/);
    if(!line.trim())return <View key={i} style={{height:5}}/>;
    return <Text key={i} selectable accessibilityRole={heading?'header':undefined} style={{color:p.ink,fontSize:heading?heading[1].length<=2?21:17:15,fontWeight:heading?'800':'400',lineHeight:heading?29:25,marginTop:heading?12:0,padding:code?10:0,backgroundColor:code?p.bg:undefined,fontFamily:code?'monospace':undefined}}>{bullet?'• ':''}{code?line:inline(heading?heading[2]:bullet?bullet[1]:line,p)}</Text>;
  })}</View>;
}

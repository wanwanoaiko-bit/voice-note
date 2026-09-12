'use strict';
const $=id=>document.getElementById(id),key='voice-note-v1',uid=()=>crypto.randomUUID();
const defaults=()=>({notes:[{id:uid(),name:'自己紹介',phrases:['はじめまして。','よろしくお願いします。','現在声を出すことができません。','文字と音声読み上げでお話しします。','少し待ってください。'].map(text=>({id:uid(),text,favorite:false}))},{id:uid(),name:'レッスン1',phrases:[{id:uid(),text:'Could you say that again, please?',favorite:false}]},{id:uid(),name:'日常',phrases:[]}],history:[],settings:{rate:1,ja:'',en:'',language:'auto'}});
function valid(s){return s&&Array.isArray(s.notes)&&s.notes.length>0&&s.notes.length<300&&s.notes.every(n=>typeof n.id==='string'&&typeof n.name==='string'&&n.name.length<=80&&Array.isArray(n.phrases)&&n.phrases.every(p=>typeof p.id==='string'&&typeof p.text==='string'&&p.text.length<=10000))&&Array.isArray(s.history)&&s.history.every(t=>typeof t==='string'&&t.length<=10000)&&s.settings&&Number.isFinite(s.settings.rate)&&s.settings.rate>=.3&&s.settings.rate<=3;}
let state,loadError=false;try{const raw=localStorage.getItem(key);state=raw?JSON.parse(raw):defaults();if(!valid(state))throw Error();}catch{state=defaults();loadError=true;}
let active=state.notes.some(n=>n.id===state.active)?state.active:state.notes[0].id,favorites=false,editing=null,voices=[],generation=0,timer;
function notify(t){$('status').textContent=t;clearTimeout(timer);timer=setTimeout(()=>$('status').textContent='',4800)}
function persist(){state.active=active;try{localStorage.setItem(key,JSON.stringify(state));return true}catch{notify('保存できませんでした。バックアップを保存し、ブラウザの空き容量や設定を確認してください。');return false}}
const note=()=>state.notes.find(n=>n.id===active);
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function btn(text,cls,fn,label){const b=el('button',cls,text);b.type='button';b.onclick=fn;if(label)b.setAttribute('aria-label',label);return b}
function render(){const tabs=$('tabs');tabs.replaceChildren();state.notes.forEach(n=>{let b=btn(n.name,n.id===active?'active':'',()=>{active=n.id;favorites=false;persist();render()});b.setAttribute('aria-current',String(n.id===active));tabs.append(b)});tabs.append(btn('+','add',()=>openEditor('new'),'ノートを追加'));$('noteTitle').textContent=note().name;$('save').textContent='＋ 「'+note().name+'」に保存';$('allFilter').classList.toggle('selected',!favorites);$('favoriteFilter').classList.toggle('selected',favorites);const list=note().phrases.filter(p=>!favorites||p.favorite);$('count').textContent=list.length+'フレーズ';$('phrases').replaceChildren();if(!list.length)$('phrases').append(el('div','empty',favorites?'お気に入りはまだありません。☆で登録できます。':'文章を入力して、このノートに保存しましょう。'));list.forEach(p=>{const row=el('article','phrase'),body=el('div','phrase-body'),meta=el('div','phrase-meta');body.append(el('p','',p.text));meta.append(el('span','',/[ぁ-んァ-ヶ一-龠]/u.test(p.text)?'日本語':'ENGLISH'));let star=btn(p.favorite?'★':'☆','icon star'+(p.favorite?' on':''),()=>{p.favorite=!p.favorite;persist();render()},'お気に入り');star.setAttribute('aria-pressed',String(!!p.favorite));meta.append(star,btn('編集','icon',()=>openEditor('phrase',p.id),'フレーズを編集'));body.append(meta);row.append(body,btn('▶','play',()=>speak(p.text),'読み上げ：'+p.text));$('phrases').append(row)});renderHistory()}
function renderHistory(){$('history').replaceChildren();if(!state.history.length)$('history').append(el('p','hint','読み上げた文章がここに表示されます。'));state.history.slice(0,5).forEach(t=>{let b=btn('','history-item',()=>speak(t));b.append(el('span','',t),el('span','','▶'));$('history').append(b)})}
function openEditor(type,id){editing={type,id};$('editTitle').textContent=type==='new'?'ノートを作成':type==='note'?'ノートを編集':'フレーズを編集';$('editLabel').textContent=type==='phrase'?'文章':'ノート名';$('editValue').maxLength=type==='phrase'?10000:80;$('editValue').value=type==='new'?'':type==='note'?note().name:note().phrases.find(p=>p.id===id).text;$('deleteItem').hidden=type==='new';$('editDialog').showModal();$('editValue').focus()}
$('editForm').onsubmit=e=>{e.preventDefault();const value=$('editValue').value.trim();if(!value)return;if(editing.type==='new'){const n={id:uid(),name:value,phrases:[]};state.notes.push(n);active=n.id;}else if(editing.type==='note')note().name=value;else note().phrases.find(p=>p.id===editing.id).text=value;persist();render();$('editDialog').close()};
$('deleteItem').onclick=()=>{if(!confirm(editing.type==='note'?'このノートと中のフレーズを削除しますか？':'このフレーズを削除しますか？'))return;if(editing.type==='note'){state.notes=state.notes.filter(n=>n.id!==active);if(!state.notes.length)state.notes.push({id:uid(),name:'新しいノート',phrases:[]});active=state.notes[0].id;}else note().phrases=note().phrases.filter(p=>p.id!==editing.id);persist();render();$('editDialog').close()};
$('closeEdit').onclick=()=>$('editDialog').close();$('noteMenu').onclick=()=>openEditor('note');$('allFilter').onclick=()=>{favorites=false;render()};$('favoriteFilter').onclick=()=>{favorites=true;render()};$('draft').oninput=()=>$('charCount').textContent=$('draft').value.length+'文字';$('save').onclick=()=>{const text=$('draft').value.trim();if(!text){notify('保存する文章を入力してください。');return}note().phrases.push({id:uid(),text,favorite:false});favorites=false;if(persist())notify('ノートに保存しました。');render()};
function segments(text,lang='auto'){if(lang!=='auto')return [{text,lang}];const parts=text.match(/[A-Za-z]+(?:['’.-][A-Za-z]+)*(?:[ ,!?;:\n]+[A-Za-z]+(?:['’.-][A-Za-z]+)*)*|[^A-Za-z]+/g)||[];const result=[];parts.forEach(t=>{let l=/[A-Za-z]/.test(t)?'en':/[ぁ-んァ-ヶ一-龠]/u.test(t)?'ja':result.at(-1)?.lang||(/[ぁ-んァ-ヶ一-龠]/u.test(text)?'ja':'en');if(result.at(-1)?.lang===l)result.at(-1).text+=t;else result.push({text:t,lang:l})});return result}
// Keep queued utterances alive until playback ends (including on mobile).
let queuedUtterances=[],currentSpeech=null,startWatchdog,waitTicker,lastAttempt=null;
function speechMessage(message){$('speechProgress').textContent=message}
function armStartWatchdog(token){
 clearTimeout(startWatchdog);clearInterval(waitTicker);let seconds=0;
 speechMessage('音声の開始を待っています（0 / 8秒）');
 waitTicker=setInterval(()=>{if(token===generation)speechMessage('音声の開始を待っています（'+(++seconds)+' / 8秒）')},1000);
 startWatchdog=setTimeout(()=>{if(token!==generation)return;stop();speechMessage('音声が開始しませんでした。「端末音声・標準速度で再試行」を押してください。');},8000);
}
function voiceFor(lang){
 const available=voices.filter(v=>v.lang.toLowerCase().startsWith(lang));
 const selected=available.find(v=>v.voiceURI===state.settings[lang]);
 if(selected)return selected;
 const male=v=>/keita|ichiro|takumi|otoya|hattori|naoki|david|mark|daniel|alex|guy|aaron|fred|male\b/i.test(v.name)&&!/female/i.test(v.name);
 const local=state.settings.preferLocal===true;
 const quality=v=>/natural|neural|premium|enhanced|高品質/i.test(v.name);
 const qualityFirst=state.settings.qualityFirst!==false;
 return available.map((v,i)=>({v,i,score:(quality(v)?(qualityFirst?300:50):0)+(male(v)?100:0)+(local&&v.localService?400:0)+(v.lang.toLowerCase()===(lang==='en'?'en-us':'ja-jp')?10:0)+(v.default?1:0)})).sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.v;
}
function speechChunks(text,language){
 return segments(text.replace(/(?<=[A-Za-z])[～〜]/g,''),language).flatMap(part=>{
  // Quotation marks are visual delimiters: avoid extra pauses around quoted English.
  const spoken=part.text.replace(/[「」『』“”]/g,'').replace(/(?<=[A-Za-z])[～〜]/g,'');
  return (spoken.match(/[^。！？\n]+[。！？\n]*|[。！？\n]+/gu)||[])
   .filter(t=>/[\p{L}\p{N}]/u.test(t))
   .map(t=>({text:t,lang:part.lang}));
 });
}
function stop(){clearTimeout(startWatchdog);clearInterval(waitTicker);generation++;if('speechSynthesis'in window&&(speechSynthesis.speaking||speechSynthesis.pending||speechSynthesis.paused))speechSynthesis.cancel();$('speak').disabled=false;speechMessage('停止しました。');queuedUtterances=[];currentSpeech=null;$('speak').textContent='▶ 読み上げる'}
function speak(text,language=state.settings.language||'auto',localOnly=false){
 text=String(text);
 if(!text.trim()){notify('読み上げる文章を入力してください。');return}
 if(!('speechSynthesis'in window)){notify('このブラウザは音声読み上げに対応していません。別のブラウザで開いてください。');return}
 stop();voices=speechSynthesis.getVoices();const token=generation;
 const chunks=speechChunks(text,language);
 if(!chunks.length){notify('読み上げる言葉を入力してください。');return}
 if(localOnly&&chunks.some(c=>!voices.some(v=>v.localService&&v.lang.toLowerCase().startsWith(c.lang)))){speechMessage('この文章の言語に対応する端末音声が見つかりません。音声設定で別の声を選んでください。');return}
 currentSpeech={text,language};lastAttempt={text,language};
 let recorded=false;const rate=localOnly?1:Math.max(.3,Math.min(3,Number($('rate').value)||1));
 if(speechSynthesis.paused)speechSynthesis.resume();
 $('speak').textContent='音声を準備中…';$('speak').disabled=true;
 queuedUtterances=chunks.map((c,i)=>{
  const u=new SpeechSynthesisUtterance(c.text),v=localOnly?voices.find(v=>v.localService&&v.lang.toLowerCase().startsWith(c.lang)):voiceFor(c.lang);
  u.lang=v?v.lang:(c.lang==='ja'?'ja-JP':'en-US');if(v)u.voice=v;u.rate=rate;u.pitch=1;u.volume=1;
  u.onstart=()=>{if(token!==generation)return;clearTimeout(startWatchdog);clearInterval(waitTicker);$('speak').disabled=false;speechMessage('再生中：'+(v?v.name:u.lang)+' / 速度設定 '+rate.toFixed(1));$('speak').textContent='♪ 読み上げ中';if(!recorded){recorded=true;state.history=[text,...state.history.filter(t=>t!==text)].slice(0,30);persist();renderHistory()}};
  u.onend=()=>{if(token!==generation)return;if(i===chunks.length-1){clearTimeout(startWatchdog);clearInterval(waitTicker);$('speak').disabled=false;speechMessage('読み上げが終了しました。');queuedUtterances=[];currentSpeech=null;$('speak').textContent='▶ 読み上げる'}else{armStartWatchdog(token)}};
  u.onerror=e=>{if(token!==generation)return;stop();speechMessage('音声を開始・継続できませんでした（'+e.error+'）。端末音声で再試行してください。');if(e.error!=='canceled'&&e.error!=='interrupted')notify('音声を再生できませんでした。音声設定と端末の音量・接続を確認してください。')};
  return u;
 });
 // Enqueue all parts now, rather than waiting for an onend callback to submit the next language.
 // This removes the app-side handoff; engine switching latency is still device-dependent.
 const batch=queuedUtterances;
 armStartWatchdog(token);
 try{for(const u of batch){if(token!==generation)break;speechSynthesis.speak(u)}}catch{stop();notify('音声を再生できませんでした。別の音声を選んでお試しください。')}
}

$('speechProgress').textContent='再生改善版 6 · 読み込み完了';$('retryLocal').onclick=()=>{const attempt=lastAttempt||{text:$('draft').value,language:state.settings.language||'auto'};speak(attempt.text,attempt.language,true)};
$('speak').onclick=()=>speak($('draft').value);$('stop').onclick=stop;$('language').value=state.settings.language||'auto';$('language').onchange=()=>{state.settings.language=$('language').value;persist()};$('draft').onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')speak($('draft').value)};
function loadVoices(){voices='speechSynthesis'in window?speechSynthesis.getVoices():[];['ja','en'].forEach(lang=>{const s=$(lang+'Voice');s.replaceChildren();s.append(new Option('自動選択',''));voices.filter(v=>v.lang.toLowerCase().startsWith(lang)).forEach(v=>s.append(new Option(v.name+(v.localService?' · 端末音声':' · 通信を利用する場合あり'),v.voiceURI)));s.value=state.settings[lang]||'';if(s.selectedIndex<0)s.value='';s.onchange=()=>{state.settings[lang]=s.value;persist()}})}
$('preferLocal').checked=state.settings.preferLocal===true;$('preferLocal').onchange=()=>{state.settings.preferLocal=$('preferLocal').checked;persist()};
$('qualityFirst').checked=state.settings.qualityFirst!==false;$('qualityFirst').onchange=()=>{state.settings.qualityFirst=$('qualityFirst').checked;persist()};
$('settingsOpen').onclick=()=>{loadVoices();$('settings').showModal()};$('closeSettings').onclick=()=>$('settings').close();$('rate').value=state.settings.rate;$('rateValue').textContent=state.settings.rate.toFixed(1)+'×';$('rate').oninput=()=>{state.settings.rate=Number($('rate').value);$('rateValue').textContent=state.settings.rate.toFixed(1)+'×';persist()};$('rate').onchange=()=>{if(currentSpeech){const playback={...currentSpeech};speak(playback.text,playback.language);notify('速度を変更して、文章の先頭から読み上げます。')}};document.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{$('rate').value=b.dataset.rate;$('rate').oninput();$('rate').onchange()});document.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>speak(b.dataset.test==='ja'?'こんにちは。この声でお話しします。':'I would like to be able to speak naturally.',b.dataset.test));$('clearHistory').onclick=()=>{if(state.history.length&&confirm('読み上げ履歴を消去しますか？')){state.history=[];persist();renderHistory()}};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='voice-note-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error();const data=JSON.parse(await file.text());if(!valid(data))throw Error();if(!confirm('現在のノート・履歴・設定をバックアップの内容に置き換えますか？'))return;stop();state=data;$('preferLocal').checked=state.settings.preferLocal===true;$('qualityFirst').checked=state.settings.qualityFirst!==false;active=state.notes[0].id;favorites=false;persist();render();loadVoices();$('language').value=state.settings.language||'auto';$('rate').value=state.settings.rate;$('rateValue').textContent=state.settings.rate.toFixed(1)+'×';notify('バックアップを復元しました。')}catch{notify('このファイルは復元できません。Voice Noteのバックアップを選んでください。')}finally{e.target.value=''}};
render();loadVoices();if('speechSynthesis'in window)speechSynthesis.addEventListener('voiceschanged',loadVoices);if(loadError)notify('保存データを読み込めませんでした。バックアップがあれば復元してください。');

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.addEventListener('pagehide',stop);

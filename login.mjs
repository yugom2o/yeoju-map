import { deriveSession, decryptText } from './crypto.mjs';
const payload=JSON.parse(document.getElementById('payload').textContent);
const form=document.getElementById('form'), message=document.getElementById('message');
const prefix='yj-v3:'+new URL('.',location.href).pathname+':';
const database=prefix+'keys';
async function keyStore(mode, operation) {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(database,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('keys');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('keys',mode),r=operation(tx.objectStore('keys'));
      tx.oncomplete=()=>{db.close();resolve(r?.result)};
      tx.onerror=()=>{db.close();reject(tx.error)};
    };
  });
}
const getLock=()=>{try{return JSON.parse(localStorage.getItem(prefix+'lock'))||{failures:0,until:0}}catch{return {failures:0,until:0}}};
const saveLock=value=>{try{localStorage.setItem(prefix+'lock',JSON.stringify(value))}catch{}};
let busy=false;
async function launch(session,html) {
  window.YJ_SESSION={...session,prefix:prefix+session.mapId+':'};
  window.YJ_LOGOUT=async()=>{
    // Tear down the application before clearing storage: outstanding callbacks in
    // the old document must not write its in-memory marks back during reload.
    const scope=window.YJ_SESSION.prefix;
    document.querySelector('iframe')?.remove();
    try{await keyStore('readwrite',s=>s.clear())}catch{}
    for(const key of Object.keys(localStorage)) if(key.startsWith(scope)) localStorage.removeItem(key);
    window.YJ_SESSION=null;
    location.reload();
  };
  const frame=document.createElement('iframe');
  frame.title='ヨジュ買い物マップ';frame.allow='geolocation';frame.srcdoc=html;
  document.body.append(frame);document.getElementById('login').hidden=true;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const lock=getLock();
  if(lock.until>Date.now()){message.textContent=`あと${Math.ceil((lock.until-Date.now())/1000)}秒待ってください。`;return}
  busy=true;document.getElementById('unlock').disabled=true;message.textContent='地図を開いています…';
  let session,html;
  try {
    session=await deriveSession(document.getElementById('password').value,payload.salt,payload.mapSalt);
    html=await decryptText(session.key,payload);
  } catch {
    const failures=lock.failures+1;saveLock({failures:failures>=5?0:failures,until:failures>=5?Date.now()+30000:0});
    message.textContent=failures>=5?'合言葉が違います。30秒待ってから試してください。':'合言葉が違います。';
    busy=false;document.getElementById('unlock').disabled=false;return;
  }
  saveLock({failures:0,until:0});document.getElementById('password').value='';
  if(document.getElementById('remember').checked) {
    try{await keyStore('readwrite',s=>s.put({...session,version:payload.version},'session'))}
    catch{message.textContent='この端末では合言葉を記憶できません。'}
  } else {try{await keyStore('readwrite',s=>s.clear())}catch{}}
  await launch(session,html);
});
if(!crypto.subtle){message.textContent='HTTPSまたはlocalhostで開いてください。';document.getElementById('unlock').disabled=true}
else {
  try{
    const saved=await keyStore('readonly',s=>s.get('session'));
    if(saved?.version===payload.version) await launch(saved,await decryptText(saved.key,payload));
    else if(saved) await keyStore('readwrite',s=>s.clear());
  }catch{try{await keyStore('readwrite',s=>s.clear())}catch{}}
}
if('serviceWorker' in navigator) {
  try {
    const registration=await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    document.getElementById('offline').textContent='オフラインで開く準備ができました。';
    registration.addEventListener('updatefound',()=>{document.getElementById('offline').textContent='新しい版を準備しています。次回起動時に反映されます。'});
  } catch { document.getElementById('offline').textContent='オフライン用の保存に失敗しました。通信がある場所で開き直してください。'; }
}

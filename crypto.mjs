const encoder = new TextEncoder();
export const ITERATIONS = 600000;
export const b64 = bytes => {
  let result = '';
  for (const byte of new Uint8Array(bytes)) result += String.fromCharCode(byte);
  return btoa(result);
};
export const unb64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export async function deriveSession(password, salt, mapSalt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const params = value => ({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(value), iterations: ITERATIONS });
  const key = await crypto.subtle.deriveKey(params(salt), material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const bits = await crypto.subtle.deriveBits(params(mapSalt), material, 256);
  const mapId = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  return { key, mapId };
}
export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return { iv: b64(iv), data: b64(data) };
}
export async function decryptText(key, payload) {
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.data));
  return new TextDecoder().decode(bytes);
}
export async function createUserPayload(html, config) {
  if(!Array.isArray(config.users)||config.users.length!==2||new Set(config.users.map(u=>u.id)).size!==2||new Set(config.users.map(u=>u.password)).size!==2) throw new Error('異なる2人分の利用者と合言葉が必要です');
  const key=await crypto.subtle.importKey('raw',unb64(config.contentKey),'AES-GCM',false,['encrypt','decrypt']);
  const users=[];
  for(const user of config.users) {
    if(!user.id||!user.name||[...user.password].length<12)throw new Error('利用者情報または合言葉が不正です');
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))),mapSalt=b64(crypto.getRandomValues(new Uint8Array(16)));
    const wrapper=await deriveSession(user.password,salt,mapSalt);
    const encrypted=await encryptText(wrapper.key,JSON.stringify({contentKey:config.contentKey,mapId:config.mapId,userId:user.id,name:user.name}));
    users.push({salt,mapSalt,...encrypted});
  }
  return {format:2,app:await encryptText(key,html),users};
}
export async function unlockPayload(password,payload) {
  if(payload.format!==2)return deriveSession(password,payload.salt,payload.mapSalt);
  for(const user of payload.users) {
    const wrapper=await deriveSession(password,user.salt,user.mapSalt);
    let data;
    try{data=JSON.parse(await decryptText(wrapper.key,user))}catch{continue}
    const key=await crypto.subtle.importKey('raw',unb64(data.contentKey),'AES-GCM',false,['encrypt','decrypt']);
    return {key,mapId:data.mapId,userId:data.userId,name:data.name};
  }
  throw new Error('合言葉が違います');
}
export const decryptApplication=(session,payload)=>decryptText(session.key,payload.format===2?payload.app:payload);

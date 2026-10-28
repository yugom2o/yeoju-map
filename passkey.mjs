import {b64,unb64,encryptText,decryptText} from './crypto.mjs';
const random=()=>crypto.getRandomValues(new Uint8Array(32));
const options={timeout:60000,userVerification:'required'};
const aad=()=>location.origin+new URL('.',location.href).pathname;
export async function passkeyAvailable(){
  return !!(window.PublicKeyCredential&&navigator.credentials&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
}
async function secret(credential,salt){
  let result=credential.getClientExtensionResults().prf?.results?.first;
  if(!result){
    credential=await navigator.credentials.get({publicKey:{...options,challenge:random(),allowCredentials:[{type:'public-key',id:credential.rawId}],extensions:{prf:{eval:{first:salt}}}}});
    result=credential?.getClientExtensionResults().prf?.results?.first;
  }
  if(!result)throw new Error('この端末のパスキーは地図の暗号化解除に未対応です。Safariを更新するか、合言葉を使ってください。');
  return crypto.subtle.importKey('raw',result,'AES-GCM',false,['encrypt','decrypt']);
}
export async function registerPasskey(password,user){
  if(!await passkeyAvailable())throw new Error('対応するiPhoneのSafariなど、端末認証が使えるブラウザで開いてください。');
  const salt=random();
  const credential=await navigator.credentials.create({publicKey:{
    ...options,challenge:random(),rp:{name:'ヨジュ買い物マップ'},
    user:{id:new TextEncoder().encode(aad()+':'+user.id),name:user.name,displayName:user.name},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'required',userVerification:'required'},
    attestation:'none',extensions:{prf:{eval:{first:salt}}}
  }});
  if(!credential)throw new Error('登録を中止しました');
  const key=await secret(credential,salt);
  return {credentialId:b64(credential.rawId),salt:b64(salt),origin:aad(),name:user.name,...await encryptText(key,password)};
}
export async function unlockPasskey(record){
  if(record.origin!==aad())throw new Error('登録したURLから開いてください');
  const credential=await navigator.credentials.get({publicKey:{...options,challenge:random(),allowCredentials:[{type:'public-key',id:unb64(record.credentialId)}],extensions:{prf:{eval:{first:unb64(record.salt)}}}}});
  if(!credential)throw new Error('認証を中止しました');
  const result=credential.getClientExtensionResults().prf?.results?.first;
  if(!result)throw new Error('このブラウザはパスキーによる解除に未対応です。合言葉を使ってください。');
  const key=await crypto.subtle.importKey('raw',result,'AES-GCM',false,['decrypt']);
  return decryptText(key,record);
}

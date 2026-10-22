// Run-local RFC7516 compact JWE; no network, provider credential or transcript.
import fs from 'node:fs';
import crypto from 'node:crypto';
const header = Buffer.from(JSON.stringify({alg:'RSA-OAEP-256',enc:'A256GCM'})).toString('base64url');
export function seal(data, publicPem) {
  if (data.length > 2*1024*1024) throw Error('bound');
  const pub=crypto.createPublicKey(publicPem);
  if(pub.asymmetricKeyType!=='rsa'||pub.asymmetricKeyDetails.modulusLength<3072)throw Error('key');
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(header,'ascii'));
  const ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);
  const wrapped=crypto.publicEncrypt({key:pub,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);
  key.fill(0);
  return [header,wrapped.toString('base64url'),iv.toString('base64url'),ciphertext.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
}
export function open(encoded, privatePem) {
  if(encoded.length>3*1024*1024)throw Error('bound');
  const a=encoded.split('.');
  if(a.length!==5||a[0]!==header||a.some(x=>!/^[-_A-Za-z0-9]+$/.test(x)))throw Error('format');
  const [wrapped,iv,ciphertext,tag]=a.slice(1).map(x=>Buffer.from(x,'base64url'));
  if(iv.length!==12||tag.length!==16)throw Error('length');
  const key=crypto.privateDecrypt({key:privatePem,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},wrapped);
  if(key.length!==32)throw Error('key');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(header,'ascii'));decipher.setAuthTag(tag);
  try{return Buffer.concat([decipher.update(ciphertext),decipher.final()]);}finally{key.fill(0);}
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    const [mode,input,keyFile,output]=process.argv.slice(2);
    let data;
    if(mode==='seal')data=Buffer.from(seal(fs.readFileSync(input),fs.readFileSync(keyFile)));
    else if(mode==='open')data=open(fs.readFileSync(input,'utf8'),fs.readFileSync(keyFile));
    else throw Error('mode');
    fs.writeFileSync(output,data,{mode:0o600,flag:'wx'});
  }catch{console.error('Private result cryptographic operation failed.');process.exitCode=1;}
}

// Shared copy/verification selector; retired01 can never consume another claim.
import fs from 'node:fs';
export function profileName(slot) {
  if(!/^(0[2-9]|1[0-3]|z0[1-3])$/.test(slot))throw Error('Inactive or retired slot.');
  return slot==='10'?'consumer-first-stop.json':slot.startsWith('z')?'consumer-zero.json':'consumer.json';
}
export function verify(slot,file) {
  const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url));
  const actual=fs.readFileSync(file);
  if(!actual.equals(wanted))throw Error('Selected profile bytes differ from reviewed slot profile.');
  const expected=slot==='10'?1:slot.startsWith('z')?0:8;
  if(JSON.parse(actual).budgets.invocation.maximumProviderRequests!==expected)throw Error('Request ceiling mismatch.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    const [mode,slot,file]=process.argv.slice(2);
    if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(slot),import.meta.url),file);
    else if(mode!=='verify')throw Error('mode');
    verify(slot,file);
  }catch{console.error('Reviewed slot/profile verification failed.');process.exitCode=1;}
}

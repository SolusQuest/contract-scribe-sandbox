// This prepared diagnostic tuple enables only unused09; all other slots fail closed.
import fs from 'node:fs';
export function profileName(slot) {
  if(slot!=='09')throw Error('Inactive or retired slot.');
  return 'consumer.json';
}
export function verify(slot,file) {
  const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url));
  const actual=fs.readFileSync(file);
  if(!actual.equals(wanted))throw Error('Selected profile bytes differ from reviewed slot profile.');
  const expected=8;
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

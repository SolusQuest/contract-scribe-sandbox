// This prepared diagnostic tuple enables only unused15; all other slots fail closed.
import fs from 'node:fs';
export function profileName(slot) {
  if(slot!=='15')throw Error('Inactive or retired slot.');
  return 'consumer.json';
}
export function verify(slot,file) {
  const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url));
  const actual=fs.readFileSync(file);
  if(!actual.equals(wanted))throw Error('Selected profile bytes differ from reviewed slot profile.');
  const expected=8;
  const profile=JSON.parse(actual),i=profile.budgets.invocation,c=profile.budgets.campaign;
  if(i.maximumProviderRequests!==expected||i.maximumTargets!==5||i.maximumCachedInputTokens!==174622||i.maximumUncachedInputTokens!==174622||i.maximumOutputTokens!==32768||i.maximumRequestOutputTokens!==4096
    ||c.maximumProviderRequests!==8||c.maximumInputTokens!==349244||c.maximumUncachedInputTokens!==174622||c.maximumOutputTokens!==32768||c.maximumCostMicrounits!==960640)throw Error('Reviewed downward budget ceiling mismatch.');
  // Full remaining input at peak miss plus all output and conservative per-dispatch rounding.
  const worst=BigInt(i.maximumCachedInputTokens+i.maximumUncachedInputTokens)*2n+BigInt(i.maximumOutputTokens)*8n+BigInt(expected-1);
  if(worst>960640n)throw Error('Original remaining cumulative budget exceeded.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    const [mode,slot,file]=process.argv.slice(2);
    if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(slot),import.meta.url),file);
    else if(mode!=='verify')throw Error('mode');
    verify(slot,file);
  }catch{console.error('Reviewed slot/profile verification failed.');process.exitCode=1;}
}

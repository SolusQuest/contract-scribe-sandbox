// Local continuation candidate: three no-provider preflight gates only.
// consumer.json is a separately reviewed FUTURE aggregate projection, never selected here.
import fs from 'node:fs';
const profiles=Object.freeze({'open-wait':'consumer-zero.json','closed-samebase':'consumer-zero.json','closed-config':'consumer-first-stop.json'});
export function profileName(phase) {
 if(!Object.hasOwn(profiles,phase))throw Error('Inactive lifecycle phase; paid execution unavailable.');
 return profiles[phase];
}
const aggregate={maximumProviderRequests:30,maximumAttemptsPerTarget:2,maximumInputTokens:1160015,maximumUncachedInputTokens:559093,maximumOutputTokens:104403,maximumCostMicrounits:3004251,maximumElapsedMilliseconds:7200000,maximumCandidatesPerBlock:30};
function check(value,phase) {
 const i=value.budgets.invocation,c=value.budgets.campaign;
 if(JSON.stringify(c)!==JSON.stringify(aggregate))throw Error('Prospective funded aggregate mismatch.');
 const expectedTargets=phase==='closed-config'?4:5;
 if(i.maximumProviderRequests!==0||i.maximumTargets!==expectedTargets
 ||i.maximumCachedInputTokens!==174622||i.maximumUncachedInputTokens!==174622
 ||i.maximumOutputTokens!==32768||i.maximumRequestOutputTokens!==4096
 ||i.maximumElapsedMilliseconds!==600000||i.maximumRequestElapsedMilliseconds!==90000
 ||i.maximumConnectMilliseconds!==10000||i.maximumToolCalls!==64||i.maximumToolCallsPerResponse!==8)
  throw Error('No-provider profile or original per-invocation ceilings mismatch.');
}
export function verify(phase,file) {
 const actual=fs.readFileSync(file),wanted=fs.readFileSync(new URL('./'+profileName(phase),import.meta.url));
 if(!actual.equals(wanted))throw Error('Selected profile differs from reviewed phase.');
 check(JSON.parse(actual),phase);
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  const [mode,phase,file]=process.argv.slice(2);
  if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(phase),import.meta.url),file);
  else if(mode!=='verify')throw Error('mode');
  verify(phase,file);
 }catch{console.error('Reviewed no-provider lifecycle profile rejected.');process.exitCode=1;}
}

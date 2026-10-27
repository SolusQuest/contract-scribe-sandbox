// Fixed firstfunded5 purpose: funding21, stable productcampaign20.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const paidProfileSHA256='84856ae9ffcbe92a1a2c58c5e1c1babe30e8afb59ab21fcbbcbd62a7801ba8b5';
export function profileName(slot){if(slot!=='21')throw Error('Inactive or retired funding slot.');return 'consumer.json';}
export function verify(slot,file){
 const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url)),actual=fs.readFileSync(file);
 if(!actual.equals(wanted)||createHash('sha256').update(actual).digest('hex')!==paidProfileSHA256)throw Error('Exact funded21 full profile rejected.');
 const v=JSON.parse(actual),i=v.budgets.invocation,c=v.budgets.campaign;
 if(i.maximumTargets!==5||i.maximumProviderRequests!==8||i.maximumCachedInputTokens!==174622||i.maximumUncachedInputTokens!==174622||i.maximumOutputTokens!==32768||i.maximumRequestOutputTokens!==4096||i.maximumElapsedMilliseconds!==600000||i.maximumRequestElapsedMilliseconds!==90000||i.maximumConnectMilliseconds!==10000||i.maximumToolCalls!==64||i.maximumToolCallsPerResponse!==8
 ||c.maximumProviderRequests!==30||c.maximumInputTokens!==1160015||c.maximumUncachedInputTokens!==559093||c.maximumOutputTokens!==104403||c.maximumCostMicrounits!==3004251||c.maximumAttemptsPerTarget!==2||c.maximumCandidatesPerBlock!==30||c.maximumElapsedMilliseconds!==7200000)throw Error('Original per-invocation or accepted cumulative limits changed.');
 const worst=BigInt(i.maximumCachedInputTokens+i.maximumUncachedInputTokens)*2n+BigInt(i.maximumOutputTokens)*8n+7n;
 if(worst>960640n)throw Error('Full permanent hold insufficient for configured exposure.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{const [mode,slot,file]=process.argv.slice(2);if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(slot),import.meta.url),file);else if(mode!=='verify')throw Error('mode');verify(slot,file);}
 catch{console.error('Exact firstfunded5 slot/profile rejected.');process.exitCode=1;}
}

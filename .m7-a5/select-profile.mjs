// Prospective AA preparatory two-target invocation, unused slot34; allocation and execution have not occurred.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const paidProfileSHA256='60c20e8ac8196d9fe1423444f344cf037ec3ae82165ad0d778ffe5449ef787a2';
export function profileName(slot){if(slot!=='35')throw Error('Inactive or retired funding slot.');return 'consumer.json';}
export function verify(slot,file){
 const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url)),actual=fs.readFileSync(file);
 if(!actual.equals(wanted)||createHash('sha256').update(actual).digest('hex')!==paidProfileSHA256)throw Error('Exact candidate Q1 funding29 full profile rejected.');
 const v=JSON.parse(actual);if(v.timeouts?.checkpointAcceptanceMilliseconds!==90000||v.timeouts.repositoryToolMilliseconds!==90000||Object.keys(v.timeouts).length!==2)throw Error('Checkpoint configuration changed.');const i=v.budgets.invocation,c=v.budgets.campaign;
 if(i.maximumTargets!==2||i.maximumProviderRequests!==16||i.maximumCachedInputTokens!==262142||i.maximumUncachedInputTokens!==262142||i.maximumOutputTokens!==32768||i.maximumRequestOutputTokens!==4096||i.maximumElapsedMilliseconds!==1200000||i.maximumRequestElapsedMilliseconds!==90000||i.maximumConnectMilliseconds!==10000||i.maximumToolCalls!==64||i.maximumToolCallsPerResponse!==8
 ||c.maximumProviderRequests!==96||c.maximumInputTokens!==2097136||c.maximumUncachedInputTokens!==1048568||c.maximumOutputTokens!==131072||c.maximumCostMicrounits!==5242880||c.maximumAttemptsPerTarget!==2||c.maximumCandidatesPerBlock!==30||c.maximumElapsedMilliseconds!==7200000)throw Error('Original per-invocation or accepted cumulative limits changed.');
 const worst=BigInt(i.maximumCachedInputTokens+i.maximumUncachedInputTokens)*2n+BigInt(i.maximumOutputTokens)*8n+7n;
 if(worst>1310720n)throw Error('Full permanent hold insufficient for configured exposure.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{const [mode,slot,file]=process.argv.slice(2);if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(slot),import.meta.url),file);else if(mode!=='verify')throw Error('mode');verify(slot,file);}
 catch{console.error('Exact Q1 funded5 slot/profile rejected.');process.exitCode=1;}
}

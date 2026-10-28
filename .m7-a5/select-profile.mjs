// Fixed Q1 funded5 purpose: prospective Q1 funding23, candidate-only campaign X.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const paidProfileSHA256='2b7f650bde8f7587b1b43256522e883e64565d15bc606f48c2affcf304aa0073';
export function profileName(slot){if(slot!=='23')throw Error('Inactive or retired funding slot.');return 'consumer.json';}
export function verify(slot,file){
 const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url)),actual=fs.readFileSync(file);
 if(!actual.equals(wanted)||createHash('sha256').update(actual).digest('hex')!==paidProfileSHA256)throw Error('Exact candidate Q1 funding23 full profile rejected.');
 const v=JSON.parse(actual),i=v.budgets.invocation,c=v.budgets.campaign;
 if(i.maximumTargets!==5||i.maximumProviderRequests!==6||i.maximumCachedInputTokens!==130966||i.maximumUncachedInputTokens!==130966||i.maximumOutputTokens!==24576||i.maximumRequestOutputTokens!==4096||i.maximumElapsedMilliseconds!==600000||i.maximumRequestElapsedMilliseconds!==90000||i.maximumConnectMilliseconds!==10000||i.maximumToolCalls!==64||i.maximumToolCallsPerResponse!==8
 ||c.maximumProviderRequests!==24||c.maximumInputTokens!==1047732||c.maximumUncachedInputTokens!==523866||c.maximumOutputTokens!==98304||c.maximumCostMicrounits!==2881920||c.maximumAttemptsPerTarget!==2||c.maximumCandidatesPerBlock!==30||c.maximumElapsedMilliseconds!==6587252)throw Error('Original per-invocation or accepted cumulative limits changed.');
 const worst=BigInt(i.maximumCachedInputTokens+i.maximumUncachedInputTokens)*2n+BigInt(i.maximumOutputTokens)*8n+7n;
 if(worst>720480n)throw Error('Full permanent hold insufficient for configured exposure.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{const [mode,slot,file]=process.argv.slice(2);if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(slot),import.meta.url),file);else if(mode!=='verify')throw Error('mode');verify(slot,file);}
 catch{console.error('Exact Q1 funded5 Q1 slot/profile rejected.');process.exitCode=1;}
}

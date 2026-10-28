// ONLY the three accepted-X zero-model phases. Paid/old phases are inaccessible.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const profiles=Object.freeze({"open-wait": "consumer-zero.json", "closed-samebase": "consumer-zero.json", "closed-config": "consumer-first-stop.json"});
const hashes=Object.freeze({"consumer-zero.json": "08866e48c4891c209d05137cc57055c8ac2b983ebc8b65b391e260a8462ad6ce", "consumer-first-stop.json": "df3eafc39fdbd866b1dd5cae18dbc8b52579e9733c31a021d07b7150fcceca6c"});
export function profileName(phase){if(!Object.hasOwn(profiles,phase))throw Error('Inactive phase; paid execution disabled.');return profiles[phase];}
export function verify(phase,file){
 const name=profileName(phase),actual=fs.readFileSync(file),wanted=fs.readFileSync(new URL('./'+name,import.meta.url));
 if(!actual.equals(wanted)||createHash('sha256').update(actual).digest('hex')!==hashes[name])throw Error('Exact fixed zero profile rejected.');
 const v=JSON.parse(actual),i=v.budgets.invocation;
 if(i.maximumProviderRequests!==0||i.maximumTargets!==(phase==='closed-config'?4:5)||i.maximumElapsedMilliseconds!==600000||i.maximumRequestElapsedMilliseconds!==90000||i.maximumConnectMilliseconds!==10000)throw Error('Zero cap/quota or original time limits changed.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){try{const[mode,phase,file]=process.argv.slice(2);if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(phase),import.meta.url),file);else if(mode!=='verify')throw Error('mode');verify(phase,file);}catch{console.error('Exact zero-only phase/profile rejected.');process.exitCode=1;}}

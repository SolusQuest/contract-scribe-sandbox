"""Restore only the sealed successful harness prefix; CLI reauthenticates GitHub."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,zipfile,stat
SOURCE='dd5fa0384076bedbde5ec0cdba6bae5a5e50c381'
ORIGINAL_SOURCE='3aa7f52c63856001e768b3118e469dac189dabee'
ORIGINAL_CONTROL='105b0709d58e830f7d28a7a9ee8748d09022fac8'
ARTIFACT=12937233701
SIZE=12276
DIGEST='3e63d2cb07b9d779bbe973b74d6bb71e586413be2c7fa81185fde17b1b1d915e'
HERE=Path(__file__).resolve().parent
WORK=Path(os.environ['RUNNER_TEMP'])/'m7-native-lifecycle'
def require(value):
    if not value:raise ValueError('original prefix proof rejected')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
try:
    require(os.environ.get('GITHUB_REPOSITORY')=='SolusQuest/contract-scribe-sandbox' and os.environ.get('GITHUB_RUN_ATTEMPT')=='1' and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch')
    require(os.environ['GITHUB_SHA']==os.environ['GITHUB_WORKFLOW_SHA']==os.environ['LIFE_APPROVED_CONTROL'])
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY') and not os.environ.get('CONTRACTSCRIBE_GITHUB_TOKEN'))
    require(subprocess.check_output(['git','-C','product','rev-parse','HEAD'],text=True).strip()==SOURCE and sha(os.environ['LIFE_CLI'])==os.environ['LIFE_CLI_SHA256'])
    WORK.mkdir(mode=0o700);archive=WORK/'prior-original-40965709678.zip'
    with archive.open('xb')as f:p=subprocess.run(['gh','api',f'repos/SolusQuest/contract-scribe-sandbox/actions/artifacts/{ARTIFACT}/zip'],stdout=f,stderr=subprocess.PIPE,timeout=120)
    require(p.returncode==0 and archive.stat().st_size==SIZE and sha(archive)==DIGEST)
    with zipfile.ZipFile(archive)as z:
        require(1<=len(z.infolist())<40)
        for i in z.infolist():
            q=Path(i.filename);require(not q.is_absolute() and '..'not in q.parts and not stat.S_ISLNK(i.external_attr>>16) and i.file_size<4*1024*1024)
        def read(name):
            names=[x for x in z.namelist()if x.endswith('/'+name)];require(len(names)==1);raw=z.read(names[0]);return json.loads(raw),hashlib.sha256(raw).hexdigest()
        state,state_hash=read('state.json');p0,p0_hash=read('p0-result.json');failed,failed_hash=read('open-wait-result.json')
    require(state['source']==ORIGINAL_SOURCE and state['control']==ORIGINAL_CONTROL and str(state['run'])=='40965709678')
    require(state['completed']==['baseline','claim-p0','paid-p0'] and state['failedPhase']=='open-wait')
    require(p0['cliContractBaseline']==ORIGINAL_SOURCE and p0['outcome']=='github-proposal.published' and p0['pullRequestUrl']=='https://github.com/SolusQuest/contract-scribe-sandbox/pull/21')
    u=p0['invocationUsage'];require(u['calls']['physicalProviderDispatches']==6 and u['calls']['activeSent']==u['calls']['activeReserved']==u['calls']['uncorrelatedDispatches']==0 and u['work']['acceptedTargets']==2 and u['work']['skippedTargets']==u['work']['failedTargets']==0 and u['accounting']['unsettledDispatches']==0)
    require(failed['outcome']=='github-proposal.human-change' and failed['invocationUsage']['calls']['physicalProviderDispatches']==0)
    campaign=json.loads((HERE/'campaign.json').read_text());require(state['campaign']==campaign['campaignLineage'] and state['targetRef']==campaign['github']['targetRef'])
    require(state['consumerSha256']==sha(HERE/'consumer.json') and state['campaignSha256']==sha(HERE/'campaign.json'))
    require(state['targetSha']=='45a382b2fc49a1a6f16a7015a4981b4a2386f5db' and subprocess.check_output(['git','-C','target','rev-parse','HEAD'],text=True).strip()==state['targetSha'])
    require(state['prs']['p0']['number']==21 and state['prs']['p0']['head']=='65c7ceed6957069b2d941fe21a181b2aacd93308')
    state['priorOriginal']={'run':40965709678,'source':ORIGINAL_SOURCE,'control':ORIGINAL_CONTROL,'artifact':ARTIFACT,'archive':archive.name,'archiveSHA256':DIGEST,'stateSHA256':state_hash,'p0SHA256':p0_hash,'failedZeroSHA256':failed_hash,'conclusion':'failure','paidGlobal48Requests':6,'originalFailureRetained':True}
    state['priorFailedInvocations']=[x for x in state['invocations']if x['label']!='p0']
    state['invocations']=[x for x in state['invocations']if x['label']=='p0'];require(len(state['invocations'])==1)
    state['source']=SOURCE;state['control']=os.environ['GITHUB_SHA'];state['run']=os.environ['GITHUB_RUN_ID']
    state.pop('failedPhase',None);state.pop('failureClass',None);state['activePhase']=None
    (WORK/'state.json').write_text(json.dumps(state,indent=2)+'\n')
    (WORK/'events.jsonl').write_text(json.dumps({'type':'restored-known-successful-prefix','originalRun':40965709678,'rawFailedOriginalPreserved':archive.name,'newRun':state['run'],'paidP0Replayed':False,'next':'open-wait with provider key absent; current CLI independently authenticates remote'})+'\n')
    print('Original successful P0 retained under original source/run; current CLI must pass a new zero-model observation before continuation.')
except BaseException:
    print('Original prefix restoration failed closed; no original mutation or model request replayed.',file=sys.stderr);sys.exit(1)

"""Keep completed evidence; prepare current HEAD before resuming Audit, never old work."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,zipfile,stat
SOURCE='dd5fa0384076bedbde5ec0cdba6bae5a5e50c381'
CONTROL='390650d8a5e0c10f9a2ac267373464c08715ac59'
ARTIFACT=12941364147
SIZE=21481
DIGEST='67752ceac5774ca34534cc36d4133a84231e5968e861ffde90ca8c172c58ce25'
OLD_DIGEST='3e63d2cb07b9d779bbe973b74d6bb71e586413be2c7fa81185fde17b1b1d915e'
TARGET='bbff767946b23e100892677de2669d486f7dbfc8'
HERE=Path(__file__).resolve().parent
WORK=Path(os.environ['RUNNER_TEMP'])/'m7-native-lifecycle'
def require(value):
    if not value:raise ValueError('completed prefix proof rejected')
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
try:
    require(os.environ.get('GITHUB_REPOSITORY')=='SolusQuest/contract-scribe-sandbox'and os.environ.get('GITHUB_RUN_ATTEMPT')=='1'and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch')
    require(os.environ['GITHUB_SHA']==os.environ['GITHUB_WORKFLOW_SHA']==os.environ['LIFE_APPROVED_CONTROL'])
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY')and not os.environ.get('CONTRACTSCRIBE_GITHUB_TOKEN'))
    require(subprocess.check_output(['git','-C','product','rev-parse','HEAD'],text=True).strip()==SOURCE and sha(os.environ['LIFE_CLI'])==os.environ['LIFE_CLI_SHA256'])
    require(subprocess.check_output(['git','-C','target','rev-parse','HEAD'],text=True).strip()==TARGET)
    WORK.mkdir(mode=0o700);archive=WORK/'prior-original-40974597118.zip'
    with archive.open('xb')as f:p=subprocess.run(['gh','api',f'repos/SolusQuest/contract-scribe-sandbox/actions/artifacts/{ARTIFACT}/zip'],stdout=f,stderr=subprocess.PIPE,timeout=120)
    require(p.returncode==0 and archive.stat().st_size==SIZE and sha(archive)==DIGEST)
    with zipfile.ZipFile(archive)as z:
        require(1<=len(z.infolist())<50)
        for i in z.infolist():
            q=Path(i.filename);require(not q.is_absolute()and '..'not in q.parts and not stat.S_ISLNK(i.external_attr>>16)and i.file_size<4*1024*1024)
        def raw(name):
            names=[x for x in z.namelist()if x.endswith('/'+name)];require(len(names)==1);return z.read(names[0])
        state_raw=raw('state.json');state=json.loads(state_raw)
        require(state['source']==SOURCE and state['control']==CONTROL and str(state['run'])=='40974597118')
        require(state['completed']==['baseline','claim-p0','paid-p0','open-wait','close-p0','closed-base','closed-config','readme1']and state['failedPhase']=='audit-q1')
        require(state['targetSha']==TARGET and state['prs']['p0']['number']==21 and state['prs']['p0']['closedUnmerged']is True and len(state['prs']['p0']['actualAddedDocumentationMethods'])==2)
        require(set(state['claims'])=={'p0'} and [x['label']for x in state['invocations']]==['p0','open-wait','closed-base','closed-config'])
        for label,outcome in [('open-wait','github-proposal.awaiting-review'),('closed-base','github-proposal.closed-unmerged'),('closed-config','github-proposal.closed-unmerged')]:
            data=raw(label+'-result.json');v=json.loads(data);require(v['cliContractBaseline']==SOURCE and v['outcome']==outcome and v['invocationUsage']['calls']['physicalProviderDispatches']==0);(WORK/(label+'-result.json')).write_bytes(data)
        error=json.loads(raw('audit-q1-audit-envelope.json'));require(error['diagnosticCodes']==['host.workspace-load.failed']and b'repository.protected-drift'in raw('audit-q1-audit-stderr.txt'))
        old=raw('prior-original-40965709678.zip');require(len(old)==12276 and hashlib.sha256(old).hexdigest()==OLD_DIGEST);(WORK/'prior-original-40965709678.zip').write_bytes(old)
        (WORK/'closed-config-configuration-override.json').write_bytes(raw('closed-config-configuration-override.json'))
        previous_events=raw('events.jsonl')
    campaign=json.loads((HERE/'campaign.json').read_text());require(state['campaign']==campaign['campaignLineage']and state['targetRef']==campaign['github']['targetRef'])
    require(state['consumerSha256']==sha(HERE/'consumer.json')and state['campaignSha256']==sha(HERE/'campaign.json'))
    state.setdefault('priorContinuations',[]).append({'run':40974597118,'control':CONTROL,'source':SOURCE,'artifact':ARTIFACT,'archive':archive.name,'archiveSHA256':DIGEST,'stateSHA256':hashlib.sha256(state_raw).hexdigest(),'originalConclusion':'failure','noNewModelCalls':True,'failedAuditPreparationRetained':True})
    state['source']=SOURCE;state['control']=os.environ['GITHUB_SHA'];state['run']=os.environ['GITHUB_RUN_ID'];state['preparedTargetSha']=TARGET
    state.pop('failedPhase',None);state.pop('failureClass',None);state['activePhase']=None
    (WORK/'state.json').write_text(json.dumps(state,indent=2)+'\n')
    marker={'type':'restored-successful-eight-phase-prefix','originalRun':40974597118,'newRun':state['run'],'originalFailureRetained':archive.name,'repeatedPaidOrPassedZero':False,'preparedByCurrentJobBeforeAudit':TARGET}
    (WORK/'events.jsonl').write_bytes(previous_events+json.dumps(marker).encode()+b'\n')
    print('Eight successful phases retained; current checkout was prepared without credentials; resume Audit before any new provider key.')
except BaseException:
    print('Completed prefix restoration failed closed; no old mutation, paid work or passed zero replayed.',file=sys.stderr);sys.exit(1)

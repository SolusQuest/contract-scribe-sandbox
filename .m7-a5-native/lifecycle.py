"""One synthetic consumer lifecycle. Product behavior remains in the pinned CLI."""
from pathlib import Path
import base64,collections,hashlib,json,os,re,subprocess,sys,time
SOURCE='3aa7f52c63856001e768b3118e469dac189dabee'
BASELINE='45a382b2fc49a1a6f16a7015a4981b4a2386f5db'
REPO='SolusQuest/contract-scribe-sandbox'
HERE=Path(__file__).resolve().parent
WORK=Path(os.environ['RUNNER_TEMP'])/'m7-native-lifecycle'
TARGET=Path('target').resolve()
SLOTS={'p0':'48','q1':'49','q2':'50','q3':'51'}
ORDER=['baseline','claim-p0','paid-p0','open-wait','close-p0','closed-base','closed-config','readme1','audit-q1','claim-q1','paid-q1','readme2','changed-base','merge-q1','audit-q2','claim-q2','paid-q2','merge-q2','audit-q3','claim-q3','paid-q3','merge-q3','audit-final','final-noop']
METHODS=[f'M:M7Observation.Operations.Method{i:02d}' for i in range(12)]
IDENTITIES=set(METHODS+['T:M7Observation.Operations'])
state={}

def require(value):
    if not value:raise ValueError('bounded lifecycle condition rejected')

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def save():
    p=WORK/'state.json';t=WORK/'state.tmp';t.write_text(json.dumps(state,indent=2)+'\n');t.replace(p)

def event(value):
    with (WORK/'events.jsonl').open('a')as f:f.write(json.dumps(value,separators=(',',':'))+'\n')

def api(path,method='GET',data=None):
    require(path=='graphql' or path.startswith('repos/'+REPO+'/'))
    ordinal=state.get('controllerAPIAttempts',0)+1;state['controllerAPIAttempts']=ordinal;save();event({'type':'api','ordinal':ordinal,'method':method,'path':path,'state':'dispatching'})
    args=['gh','api','-X',method,'-H','X-GitHub-Api-Version: 2026-03-10',path]
    if data is not None:args+=['--input','-']
    p=subprocess.run(args,input=None if data is None else json.dumps(data).encode(),capture_output=True,timeout=60)
    require(p.returncode==0 and len(p.stdout)<=2*1024*1024)
    value=json.loads(p.stdout);require(not isinstance(value,dict) or not value.get('errors'));return value

def git(args,where=TARGET,network=False,allow_failure=False,input=None):
    env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_SYSTEM':'/dev/null','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0','GIT_AUTHOR_NAME':'Synthetic lifecycle operator','GIT_COMMITTER_NAME':'Synthetic lifecycle operator','GIT_AUTHOR_EMAIL':'fixture@example.invalid','GIT_COMMITTER_EMAIL':'fixture@example.invalid'}
    if network:
        token=os.environ.get('GH_TOKEN');require(bool(token));env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='http.https://github.com/.extraHeader',GIT_CONFIG_VALUE_0='Authorization: Basic '+base64.b64encode(('x-access-token:'+token).encode()).decode())
        state['controllerGitRemoteCommands']=state.get('controllerGitRemoteCommands',0)+1;save();event({'type':'git','ordinal':state['controllerGitRemoteCommands'],'operation':args[0],'state':'dispatching'})
    p=subprocess.run(['/usr/bin/git','-c','core.hooksPath=/dev/null','-c','init.templateDir=','-c','maintenance.auto=false','-c','gc.auto=0','-c','http.followRedirects=false','-c','http.maxRetries=0','-C',str(where),*args],env=env,input=input,capture_output=True,timeout=180)
    if not allow_failure:require(p.returncode==0)
    return p

def head():return git(['rev-parse','HEAD']).stdout.decode().strip()

def guard():
    e=os.environ;require(e.get('GITHUB_REPOSITORY')==REPO and e.get('GITHUB_RUN_ATTEMPT')=='1' and e.get('GITHUB_EVENT_NAME')=='workflow_dispatch')
    require(e['GITHUB_SHA']==e['GITHUB_WORKFLOW_SHA']==e['LIFE_APPROVED_CONTROL']);require(git(['rev-parse','HEAD'],Path('control')).stdout.decode().strip()==e['GITHUB_SHA'])
    require(git(['rev-parse','HEAD'],Path('product')).stdout.decode().strip()==SOURCE)
    require(not any(e.get(k) for k in ['DOTNET_STARTUP_HOOKS','CONTRACTSCRIBE_TEST_GITHUB_ENDPOINT','CONTRACTSCRIBE_TEST_GITHUB_GIT_ENDPOINT','CONTRACTSCRIBE_TEST_GITHUB_FAULT']))
    require(sha(e['LIFE_CLI'])==e['LIFE_CLI_SHA256']);require(head()==state['targetSha'])
    require(not git(['status','--porcelain','--untracked-files=no']).stdout.strip())
    require(sha(HERE/'consumer.json')==state['consumerSha256'] and sha(HERE/'campaign.json')==state['campaignSha256'])
    p=json.loads((HERE/'consumer.json').read_text());require(p['provider']['endpoint']=='https://api.deepseek.com/chat/completions' and p['provider']['model']=='deepseek-flash' and p['provider']['requestProfile']['reasoningEffort']=='high');require(p['budgets']['invocation']['maximumTargets']==2 and p['budgets']['invocation']['maximumProviderRequests']==6 and p['timeouts']['publicationMilliseconds']==300000)

def no_credentials():require(not any(os.environ.get(k) for k in ['GH_TOKEN','GITHUB_TOKEN','CONTRACTSCRIBE_PROVIDER_API_KEY','CONTRACTSCRIBE_GITHUB_TOKEN']))

def audit(label,remaining):
    no_credentials();out=WORK/(label+'-audit.json');stdout=WORK/(label+'-audit-envelope.json');stderr=WORK/(label+'-audit-stderr.txt')
    with stdout.open('xb')as a,stderr.open('xb')as b:p=subprocess.run(['dotnet',os.environ['LIFE_CLI'],'audit','--repository-root',str(TARGET),'--input','App/App.csproj','--policy','policy.json','--output',str(out)],stdout=a,stderr=b)
    e=json.loads(stdout.read_text());raw=out.read_bytes();v=json.loads(raw);counts=e['counts'];require(p.returncode==(1 if remaining else 0));require(e['terminalLayer']=='audit' and e['terminalState']=='committed' and e['sourceRevision']==SOURCE and e['cliContractBaseline']==SOURCE and not e['diagnosticCodes']);require(e['resultDigest']==hashlib.sha256(raw).hexdigest() and e['outputCommit']=={'status':'committed','identity':e['resultDigest']})
    require(counts=={'compliant':13-remaining,'violation':remaining,'skipped':0});rows=v['results'];ids=[x['classification']['symbolRef']['documentationCommentId'] for x in rows];require(len(rows)==len(set(ids))==13 and set(ids)==IDENTITIES)
    actual=collections.Counter(x['auditOutcome'] for x in rows);require(actual['audit.outcome.violation']==remaining and actual['audit.outcome.compliant']==13-remaining and actual['audit.outcome.skipped']==0)
    require(not re.search(rb'/home/runner/|/Users/|/Volumes/',raw));state['audit']={'label':label,'target':head(),'remaining':remaining,'digest':e['resultDigest'],'counts':counts,'identities':[{'symbolRef':x['classification']['symbolRef'],'kind':x['classification']['primaryKind'],'outcome':x['auditOutcome']} for x in rows]};state.setdefault('audits',[]).append(state['audit']);save();event({'type':'audit','label':label,'target':head(),'counts':counts,'fullTargetCount':13,'methodTargetCount':12,'providerCredentialsAbsent':True});print('Audit',label,counts)

def claim(phase):
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY') and not os.environ.get('CONTRACTSCRIBE_GITHUB_TOKEN'));a=state['audit'];require(a['target']==head() and a['remaining']=={'p0':6,'q1':6,'q2':4,'q3':2}[phase])
    ref='refs/tags/m7-a5-budget-20261022-slot-'+SLOTS[phase];control=os.environ['GITHUB_SHA'];p=git(['push','--porcelain','--force-with-lease='+ref+':','https://github.com/'+REPO+'.git',control+':'+ref],Path('control'),True,True);rows=[r.split(b'\t') for r in p.stdout.splitlines() if b'\t'in r];require(p.returncode==0 and len(rows)==1 and rows[0][0]==b'*' and rows[0][1].decode()==control+':'+ref)
    actual=git(['ls-remote','--refs','https://github.com/'+REPO+'.git',ref],Path('control'),True).stdout.decode().splitlines();require(actual==[control+'\t'+ref])
    binding={'run':os.environ['GITHUB_RUN_ID'],'attempt':'1','control':control,'source':SOURCE,'slot':SLOTS[phase],'phase':phase,'target':head(),'audit':a['digest'],'consumer':state['consumerSha256'],'campaign':state['campaignSha256']};p=WORK/('claim-'+phase+'.json')
    with p.open('x')as f:f.write(json.dumps(binding,sort_keys=True)+'\n')
    p.chmod(0o400);state.setdefault('claims',{})[phase]=binding;save();event({'type':'claim','phase':phase,'ref':ref,'actualNewACK':True,'independentRead':control})

def owned_pr(number,expected_head=None):
    p=api(f'repos/{REPO}/pulls/{number}');require(p['base']['repo']['full_name']==p['head']['repo']['full_name']==REPO and p['base']['ref']==state['targetRef'][11:]);require(p['head']['ref'].startswith('contract-scribe/proposals/'))
    if expected_head:require(p['head']['sha']==expected_head)
    return p

def run_cli(label,paid=False,expected=None,code=0,override=None):
    if paid:
        phase=label;require(bool(os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY')) and bool(os.environ.get('CONTRACTSCRIBE_GITHUB_TOKEN')));require(state['claims'][phase]['target']==head() and state['claims'][phase]['audit']==state['audit']['digest']);require((WORK/('claim-'+phase+'.json')).stat().st_mode&0o777==0o400)
        with (WORK/('launch-'+phase+'.json')).open('x')as f:f.write(json.dumps(state['claims'][phase])+'\n')
    else:require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY'))
    args=['dotnet',os.environ['LIFE_CLI'],'github-proposal','--repository-root',str(TARGET),'--input','App/App.csproj','--policy','policy.json','--campaign',str(HERE/'campaign.json'),'--configuration',str(HERE/'consumer.json')]
    if override is not None:
        require(override=={'budgets':{'invocation':{'maximumTargets':1}}})
        layer=json.loads((HERE/'consumer.json').read_text());layer['budgets']['invocation']['maximumTargets']=1
        override_file=WORK/(label+'-configuration-override.json')
        with override_file.open('x')as f:f.write(json.dumps(layer,indent=2)+'\n')
        args+=['--configuration-override',str(override_file)]
    out=WORK/(label+'-result.json');err=WORK/(label+'-stderr.txt');event({'type':'invoke','label':label,'state':'starting','target':head(),'slot':SLOTS.get(label),'maximumPhysical':6 if paid else 0})
    env=dict(os.environ);env.pop('GH_TOKEN',None);env.pop('GITHUB_TOKEN',None)
    with out.open('xb')as a,err.open('xb')as b:p=subprocess.run(args,stdout=a,stderr=b,env=env)
    require(out.stat().st_size<=1024*1024 and err.stat().st_size<=65536);value=json.loads(out.read_text());require(value['cliContractBaseline']==SOURCE);usage=value['invocationUsage'];calls=usage['calls'];n=calls['physicalProviderDispatches'];record={'label':label,'code':p.returncode,'outcome':value['outcome'],'usage':usage,'target':head(),'slot':SLOTS.get(label),'pullRequestUrl':value.get('pullRequestUrl')};state.setdefault('invocations',[]).append(record);save()
    require(p.returncode==code and value['outcome']in expected)
    require(calls['activeSent']==calls['activeReserved']==calls['uncorrelatedDispatches']==0)
    if paid:
        require(0<n<=6);work=usage['work'];require(work['acceptedTargets']==work['startedTargets']==2 and work['skippedTargets']==work['failedTargets']==0);require(usage['accounting']['unsettledDispatches']==0)
        url=value['pullRequestUrl'];m=re.fullmatch(r'https://github.com/SolusQuest/contract-scribe-sandbox/pull/([1-9][0-9]*)',url);require(m is not None);pr=owned_pr(int(m[1]));require(pr['state']=='open' and pr['draft'] and not pr['merged']);state.setdefault('prs',{})[label]={'number':pr['number'],'node':pr['node_id'],'head':pr['head']['sha'],'base':pr['base']['sha'],'headRef':'refs/heads/'+pr['head']['ref']};save()
    else:require(n==0)
    require(not git(['status','--porcelain','--untracked-files=no']).stdout.strip());event({'type':'invoke','label':label,'code':p.returncode,'outcome':value['outcome'],'physical':n,'accepted':(usage.get('work')or{}).get('acceptedTargets',0)});print('Invocation',label,value['outcome'],'physical',n)

def readme(index):
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY'));before=head();p=TARGET/'README.md';p.write_bytes(p.read_bytes()+f'\nSynthetic lifecycle base note {index}.\n'.encode());git(['add','README.md']);git(['-c','commit.gpgsign=false','commit','-qm',f'test: advance synthetic lifecycle base {index}']);after=head();require(git(['diff-tree','--no-commit-id','--name-only','-r',before,after]).stdout.decode().splitlines()==['README.md']);p=git(['push','--porcelain','--force-with-lease='+state['targetRef']+':'+before,'https://github.com/'+REPO+'.git',after+':'+state['targetRef']],network=True,allow_failure=True);rows=[x.split(b'\t') for x in p.stdout.splitlines() if b'\t'in x];require(p.returncode==0 and len(rows)==1 and rows[0][0]==b' ' and rows[0][1].decode()==after+':'+state['targetRef']);require(git(['ls-remote','--refs','https://github.com/'+REPO+'.git',state['targetRef']],network=True).stdout.decode().splitlines()==[after+'\t'+state['targetRef']]);state['targetSha']=after;save();event({'type':'readme','index':index,'before':before,'after':after,'actualUpdatedACK':True})

def verify_proposal(item):
    local_ref='refs/lifecycle/proposal/'+item['head']
    git(['fetch','--no-tags','--no-write-fetch-head','https://github.com/'+REPO+'.git',item['headRef']+':'+local_ref],network=True)
    require(git(['rev-parse',local_ref]).stdout.decode().strip()==item['head'])
    require(git(['diff-tree','--no-commit-id','--name-only','-r',item['base'],item['head']]).stdout.decode().splitlines()==['App/App.cs'])
    def read(oid):
        raw=git(['show',oid+':App/App.cs']).stdout
        code=b'\n'.join(v.strip()for v in raw.splitlines()if v.strip()and not v.lstrip().startswith(b'///'))
        blocks={};pending=[]
        for line in raw.splitlines():
            if line.lstrip().startswith(b'///'):pending.append(line)
            elif line.strip():
                m=re.search(rb'public static (?:void (Method[0-9]{2})\(\)|class (Operations))',line)
                if m:blocks[(m[1] or m[2]).decode()]=b'\n'.join(pending)
                pending=[]
        return code,blocks
    before,old=read(item['base']);after,new=read(item['head']);require(before==after and set(old)==set(new))
    added=[k for k,v in new.items()if v and not old[k]];require(len(added)==2 and all(k.startswith('Method')for k in added));require(all(new[k]==v for k,v in old.items()if v))
    item['actualAddedDocumentationMethods']=added;save();event({'type':'proposal-source','head':item['head'],'onlyXMLDocumentation':True,'addedMethods':added})

def close_p0():
    item=state['prs']['p0'];p=owned_pr(item['number'],item['head']);require(p['state']=='open' and not p['merged']);verify_proposal(item);value=api(f'repos/{REPO}/pulls/{item["number"]}','PATCH',{'state':'closed'});require(value['state']=='closed' and not value.get('merged') and value['head']['sha']==item['head']);item['closedUnmerged']=True;save();event({'type':'close','phase':'p0','number':item['number'],'merged':False})

def merge(phase):
    item=state['prs'][phase];p=owned_pr(item['number'],item['head']);require(p['state']=='open' and not p['merged'])
    for delay in [2,4]:
        if p.get('mergeable') is not None:break
        time.sleep(delay);p=owned_pr(item['number'],item['head'])
    require(p.get('mergeable') is True)
    verify_proposal(item)
    if p['draft']:
        query='mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id isDraft headRefOid}}}'
        value=api('graphql','POST',{'query':query,'variables':{'id':item['node']}})['data']['markPullRequestReadyForReview']['pullRequest'];require(value['id']==item['node'] and value['isDraft'] is False and value['headRefOid']==item['head'])
    result=api(f'repos/{REPO}/pulls/{item["number"]}/merge','PUT',{'sha':item['head'],'merge_method':'merge'});require(result.get('merged')is True and re.fullmatch('[0-9a-f]{40}',result.get('sha','')))
    final=owned_pr(item['number'],item['head']);require(final['merged']is True and final['state']=='closed' and final['merge_commit_sha']==result['sha'])
    git(['fetch','--no-tags','--no-write-fetch-head','https://github.com/'+REPO+'.git',state['targetRef']+':refs/lifecycle/target'],network=True);require(git(['rev-parse','refs/lifecycle/target']).stdout.decode().strip()==result['sha']);git(['checkout','--detach',result['sha']]);state['targetSha']=result['sha'];item['merge']=result['sha'];save();event({'type':'merge','phase':phase,'number':item['number'],'head':item['head'],'actualMerge':result['sha'],'targetIndependentlyFetched':True})

def main():
    global state
    label=sys.argv[1];require(label in ORDER)
    if label=='baseline':
        no_credentials();WORK.mkdir(mode=0o700);campaign=json.loads((HERE/'campaign.json').read_text());state={'source':SOURCE,'control':os.environ['GITHUB_SHA'],'run':os.environ['GITHUB_RUN_ID'],'targetRef':campaign['github']['targetRef'],'campaign':campaign['campaignLineage'],'targetSha':BASELINE,'campaignSha256':sha(HERE/'campaign.json'),'consumerSha256':sha(HERE/'consumer.json'),'completed':[]};save()
    else:state=json.loads((WORK/'state.json').read_text())
    require(state['completed']==ORDER[:ORDER.index(label)]);guard();state['activePhase']=label;save()
    if label=='baseline':audit('baseline',6)
    elif label.startswith('claim-'):claim(label[6:])
    elif label.startswith('paid-'):run_cli(label[5:],True,{'github-proposal.published','github-proposal.published-partial'})
    elif label=='open-wait':run_cli(label,expected={'github-proposal.awaiting-review'})
    elif label=='close-p0':close_p0()
    elif label in ['closed-base','closed-config']:run_cli(label,expected={'github-proposal.closed-unmerged'},code=4,override={'budgets':{'invocation':{'maximumTargets':1}}}if label=='closed-config'else None)
    elif label.startswith('readme'):readme(int(label[-1]))
    elif label=='changed-base':run_cli(label,expected={'github-proposal.stale'},code=4)
    elif label.startswith('merge-'):merge(label[6:])
    elif label.startswith('audit-'):audit(label,{'audit-q1':6,'audit-q2':4,'audit-q3':2,'audit-final':0}[label])
    elif label=='final-noop':run_cli(label,expected={'github-proposal.no-op'});state['lifecycleComplete']=True
    state['completed'].append(label);state['activePhase']=None;save()

if __name__=='__main__':
    try:main()
    except BaseException as e:
        if WORK.exists():
            try:state['failedPhase']=sys.argv[1];state['failureClass']=type(e).__name__;save();event({'type':'failure','phase':sys.argv[1],'class':type(e).__name__,'dependentStagesStopped':True,'automaticRetry':False})
            except BaseException:pass
        print('Bounded lifecycle phase stopped; original records retained, no automatic retry.',file=sys.stderr);sys.exit(1)

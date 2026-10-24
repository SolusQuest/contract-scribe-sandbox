#!/usr/bin/env python3
# Run-local caller acquisition; no provider credential or executable invocation.
import hashlib,json,os,re,subprocess,sys,time,zipfile,stat
from pathlib import Path
MAX_ZIP=256*1024*1024
MAX_ATTEMPTS=3
ACQUISITION_SECONDS=180
BACKOFF_SECONDS=(2,4)

class TransientGet(Exception):pass

def remaining(deadline):
    value=deadline-time.monotonic()
    require(value>0)
    return value

def get(path,deadline,output=None):
    # All calls in this helper are fixed GitHub GET routes, never mutations.
    try:
        result=subprocess.run(['gh','api','repos/SolusQuest/contract-scribe/'+path],
            stdout=subprocess.PIPE if output is None else output,stderr=subprocess.PIPE,
            timeout=min(60 if output is None else 120,remaining(deadline)))
    except subprocess.TimeoutExpired as failure:
        status=re.search(rb'\(http ([0-9]{3})\)',(failure.stderr or b'').lower())
        require(not status or int(status[1]) in (502,503,504))
        raise TransientGet() from None
    remaining(deadline)
    if result.returncode:
        error=(result.stderr or b'').lower()
        status=re.search(rb'\(http ([0-9]{3})\)',error)
        transport=any(marker in error for marker in [b'dial tcp',b'tls handshake timeout',
            b'i/o timeout',b'connection reset by peer',b'unexpected eof',b'context deadline exceeded'])
        if (status and int(status[1]) in (502,503,504)) or (not status and transport):
            raise TransientGet()
        require(False)
    return json.loads(result.stdout) if output is None else None

def metadata(pin,sha,deadline):
    a=get('actions/artifacts/'+str(pin['artifactId']),deadline)
    r=get('actions/runs/'+str(pin['producerRunId']),deadline)
    jobs=get('actions/runs/'+str(pin['producerRunId'])+'/attempts/'+str(pin['producerAttempt'])+'/jobs?per_page=100',deadline)
    validate_metadata(a,r,jobs,pin,sha)
    return a

def acquire(root,product,pin,sha,approved_path,approved_bytes):
    deadline=time.monotonic()+ACQUISITION_SECONDS
    # Each failed download stays private in its own attempt directory; no reuse.
    for attempt in range(1,MAX_ATTEMPTS+1):
        remaining(deadline)
        require(approved_path.read_bytes()==approved_bytes)
        require(subprocess.check_output(['git','-C',str(product),'rev-parse','HEAD'],text=True,timeout=remaining(deadline)).strip()==sha)
        dest=root/('attempt-'+str(attempt));dest.mkdir(mode=0o700)
        try:
            a=metadata(pin,sha,deadline)
            z=dest/'artifact.zip'
            with z.open('xb') as f:get('actions/artifacts/'+str(pin['artifactId'])+'/zip',deadline,f)
            require(z.stat().st_size==a['size_in_bytes'])
            archive=unpack(z,dest/'download',pin)
            # The exact checked-out production parser/inventory remain the owners.
            sys.dont_write_bytecode=True;sys.path.insert(0,str(product/'scripts/action'))
            import payload_extract,install
            report=payload_extract._extract(str(archive),str(dest/'installed'),None)
            require(report['ok']);top=dest/'installed'/report['top']
            fresh=metadata(pin,sha,deadline)
            require(fresh['size_in_bytes']==z.stat().st_size)
            manifest=install.verify_inventory(str(top));validate_manifest(manifest,sha)
            require(approved_path.read_bytes()==approved_bytes)
            require(subprocess.check_output(['git','-C',str(product),'rev-parse','HEAD'],text=True,timeout=remaining(deadline)).strip()==sha)
            remaining(deadline)
            return top/'ContractScribe.Cli.dll'
        except TransientGet:
            if attempt==MAX_ATTEMPTS:raise
            delay=BACKOFF_SECONDS[attempt-1]
            require(remaining(deadline)>delay)
            print('Current-CI payload transient GET; bounded acquisition attempt '+str(attempt)+'/'+str(MAX_ATTEMPTS)+'.',file=sys.stderr)
            time.sleep(delay)
    require(False)

def require(ok):
    if not ok:raise ValueError('Reviewed current-CI payload identity rejected')

def validate_metadata(artifact,run,jobs,pin,sha):
    require(artifact['id']==pin['artifactId'] and artifact['name']==pin['artifactName'] and not artifact['expired'])
    require(0<artifact['size_in_bytes']<=MAX_ZIP and artifact['digest']=='sha256:'+pin['zipSha256'])
    require(artifact['workflow_run']['id']==pin['producerRunId'] and artifact['workflow_run']['head_sha']==sha and artifact['workflow_run']['repository_id']==1297409952)
    require(run['id']==pin['producerRunId'] and run['head_sha']==sha and run['workflow_id']==311270030 and run['repository']['full_name']=='SolusQuest/contract-scribe' and run['status']=='completed' and run['conclusion']=='success' and run['run_attempt']>=pin['producerAttempt'])
    for name in ['payload_producer','packed_payload']:
        matches=[j for j in jobs['jobs'] if j['name']==name]
        require(len(matches)==1 and matches[0]['status']=='completed' and matches[0]['conclusion']=='success')

def unpack(zip_path,dest,pin):
    require(zip_path.stat().st_size<=MAX_ZIP and hashlib.sha256(zip_path.read_bytes()).hexdigest()==pin['zipSha256'])
    dest.mkdir(mode=0o700)
    with zipfile.ZipFile(zip_path) as z:
        require(1<=len(z.infolist())<=4)
        for member in z.infolist():
            require(member.filename==Path(member.filename).name and not member.is_dir() and member.file_size<=MAX_ZIP and not stat.S_ISLNK(member.external_attr>>16))
            target=dest/member.filename
            with target.open('xb') as f:f.write(z.read(member))
            target.chmod(0o600)
    archives=list(dest.glob('*.tar.gz'))
    require(len(archives)==1 and archives[0].name==pin['archiveName'])
    require(hashlib.sha256(archives[0].read_bytes()).hexdigest()==pin['archiveSha256'])
    return archives[0]

def validate_manifest(m,sha):
    require(m['sourceRevision']==sha and m.get('cleanCheckout') is True and m['runtimeIdentifier']=='linux-x64' and m['targetFramework']=='net10.0' and m['entrypoint']=='ContractScribe.Cli.dll')

def main():
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY'))
    sha=os.environ['A5_PRODUCT_SHA'];product=Path(os.environ['A5_PRODUCT_ROOT']).resolve()
    require(subprocess.check_output(['git','-C',str(product),'rev-parse','HEAD'],text=True).strip()==sha)
    approved_path=Path(__file__).parent/'approved-products.json'
    approved_bytes=approved_path.read_bytes();approved=json.loads(approved_bytes)
    entry=next(x for x in approved['sources'] if x['sha']==sha);pin=entry['payload']
    require(approved['repository']=='SolusQuest/contract-scribe')
    root=Path(os.environ['RUNNER_TEMP'])/'a5-payload';root.mkdir(mode=0o700)
    cli=acquire(root,product,pin,sha,approved_path,approved_bytes)
    with open(os.environ['GITHUB_ENV'],'a') as f:f.write('A5_ACQUIRED_CLI='+str(cli)+'\n')
    print('Reviewed exact current-CI payload acquired and inventory verified; executable not yet invoked.')

if __name__=='__main__':
    try:main()
    except BaseException:
        print('Current-CI payload acquisition failed closed before provider injection.',file=sys.stderr);sys.exit(1)

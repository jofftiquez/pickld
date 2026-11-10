# Checks docs/plan.md: task counts per milestone, dependencies only point to earlier tasks,
# design screen names exist, M6 = P1, and every requirement ID in docs/requirements.md is mapped.
# Usage: python3 scripts/check-plan.py .
import re,sys,json,os
def parse(path):
    s=open(path).read()
    tasks=[]
    for blk in re.split(r'\n(?=### M\d-\d\d · )',s)[1:]:
        h=re.match(r'### (M\d-\d\d) · (.+)',blk)
        meta=re.search(r'\*\*Area:\*\* (\w+) · \*\*Priority:\*\* (P\d) · \*\*Size:\*\* (\w) · \*\*Requirements:\*\* (.*?) · \*\*Depends on:\*\* (.*?) · \*\*Issue:\*\* (.*)',blk)
        g=lambda k: (re.search(r'\*\*'+k+r':\*\* (.*)',blk) or [None,''])[1].strip()
        acc=re.findall(r'^  - \[[ x]\] (.+)$',blk,re.M)
        t=dict(id=h[1],title=h[2].strip(),area=meta[1],priority=meta[2],size=meta[3],
               reqs=[] if meta[4].strip()=='—' else [x.strip() for x in meta[4].split(',')],
               deps=[] if meta[5].strip()=='—' else [x.strip() for x in meta[5].split(',')],
               issue=meta[6].strip(),goal=g('Goal'),tests=g('Tests'),shots=g('Screenshots'),design=g('Design'),acc=acc)
        t['blk']=blk.split('\n---')[0].rstrip()
        tasks.append(t)
    return tasks
if __name__=='__main__':
    repo=sys.argv[1]
    T=parse(repo+'/docs/plan.md'); ids=[t['id'] for t in T]
    from collections import Counter
    print(Counter(i[:2] for i in ids), len(T))
    pos={i:n for n,i in enumerate(ids)}
    assert len(set(ids))==len(ids)
    for t in T:
        for d in t['deps']:
            if d not in pos: print('MISSING DEP',t['id'],d)
            elif pos[d]>=pos[t['id']]: print('ORDER',t['id'],d)
        if not t['acc']: print('NOACC',t['id'])
        for d in [x.strip() for x in t['design'].split(',')]:
            if d not in ('—','') and not os.path.exists(f"{repo}/design/screens/{d}.html"): print('NODESIGN',t['id'],d)
        if (t['id'][:2]=='M6') != (t['priority']=='P1'): print('PRIO',t['id'])
    req=open(repo+'/docs/requirements.md').read()
    allids=re.findall(r'^\| ((?:FR|NFR)-[A-Z0-9]+-\d+) \|',req,re.M)
    p0=[m for m in re.findall(r'^\| ((?:FR|NFR)-[A-Z0-9]+-\d+) \|.*\| P0 \|',req,re.M)]
    covered={r for t in T for r in t['reqs']}
    print('unknown reqs',covered-set(allids))
    print('UNMAPPED P0',[x for x in p0 if x not in covered])
    print('UNMAPPED any',[x for x in allids if x not in covered])

import csv, sys, statistics as st
from pathlib import Path
rows = list(csv.DictReader(Path(sys.argv[1]).open(), delimiter='\t'))
def f(r,k):
    try: return float(r[k])
    except: return None
for r in rows: r['t']=f(r,'Solve time')
print("n solves", len(rows), "n solvers", len({r['Video link'] for r in rows}))
bands=[(0,11),(11,13.5),(13.5,16.5),(16.5,20),(20,30),(30,999)]
keys=['Solve time','Cross frac','F2L frac','LL frac','Pause frac','TPS','TPS without pauses','Regrips','Rotations','Cross moves','F2L moves','LL moves','Cross pauses (s)','Pause before F2L (s)','F2L pauses (s)','LL pauses (s)','Cross pause frac','F2L pause frac','LL pause frac']
for lo,hi in bands:
    b=[r for r in rows if r['t'] is not None and lo<=r['t']<hi]
    if not b: continue
    print(f"\n== {lo}-{hi}s  n={len(b)} solvers={len({r['Video link'] for r in b})}")
    out=[]
    for k in keys:
        vals=[f(r,k) for r in b if f(r,k) is not None]
        if vals: out.append(f"{k}={st.mean(vals):.2f}(n{len(vals)})")
    print("; ".join(out))
    # derived seconds
    t=st.mean(r['t'] for r in b)
    cs=st.mean(r['t']*f(r,'Cross frac') for r in b); fs=st.mean(r['t']*f(r,'F2L frac') for r in b); ls=st.mean(r['t']*f(r,'LL frac') for r in b)
    tot=st.mean(f(r,'Cross moves')+f(r,'F2L moves')+f(r,'LL moves') for r in b)
    print(f"  secs: cross {cs:.2f} F2L {fs:.2f} LL {ls:.2f}; total moves {tot:.1f}")

import csv, sys, statistics as st
from pathlib import Path
rows = list(csv.DictReader(Path(sys.argv[1]).open(), delimiter='\t'))
def f(r,k):
    try: return float(r[k])
    except: return None
bands=[(0,11),(11,13.5),(13.5,16.5),(16.5,20),(20,30)]
for lo,hi in bands:
    b=[r for r in rows if lo<=f(r,'Solve time')<hi]
    lltps=[f(r,'LL TPS') for r in b if f(r,'LL TPS')]
    f2ltps=[f(r,'F2L TPS') for r in b if f(r,'F2L TPS')]
    # LL TPS excluding pauses: LL moves / (LL time - LL pauses)
    ll_np=[f(r,'LL moves')/(f(r,'Solve time')*f(r,'LL frac')-f(r,'LL pauses (s)')) for r in b if f(r,'LL pauses (s)') is not None]
    f2l_np=[f(r,'F2L moves')/(f(r,'Solve time')*f(r,'F2L frac')-f(r,'F2L pauses (s)')) for r in b if f(r,'F2L pauses (s)') is not None]
    pause_s=[f(r,'Solve time')*f(r,'Pause frac') for r in b if f(r,'Pause frac') is not None]
    print(f"{lo}-{hi}: LL TPS {st.mean(lltps):.2f}, F2L TPS {st.mean(f2ltps):.2f}, LL TPS no-pause {st.mean(ll_np) if ll_np else float('nan'):.2f}, F2L TPS no-pause {st.mean(f2l_np) if f2l_np else float('nan'):.2f}, total pause s {st.mean(pause_s) if pause_s else float('nan'):.2f}")
# per solver summary
from collections import defaultdict
d=defaultdict(list)
for r in rows: d[r['Video link']].append(r)
for k,v in sorted(d.items(), key=lambda kv: st.mean(f(r,'Solve time') for r in kv[1])):
    print(f"{st.mean(f(r,'Solve time') for r in v):6.2f} n={len(v)} moves={st.mean(f(r,'Cross moves')+f(r,'F2L moves')+f(r,'LL moves') for r in v):.0f} regrips={st.mean(f(r,'Regrips') for r in v):.0f} rot={st.mean(f(r,'Rotations') for r in v):.1f} {k}")

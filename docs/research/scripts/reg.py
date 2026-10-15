import csv, sys
from pathlib import Path
rows=list(csv.DictReader(Path(sys.argv[1]).open(), delimiter='\t'))
def f(r,k):
    try: return float(r[k])
    except: return None
def fit(xs,ys):
    n=len(xs); mx=sum(xs)/n; my=sum(ys)/n
    b=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs); a=my-b*mx
    r=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/ (sum((x-mx)**2 for x in xs)*sum((y-my)**2 for y in ys))**0.5
    return a,b,r,n
metrics={
 'cross s':lambda r:f(r,'Solve time')*f(r,'Cross frac'),
 'F2L s':lambda r:f(r,'Solve time')*f(r,'F2L frac'),
 'LL s':lambda r:f(r,'Solve time')*f(r,'LL frac'),
 'pause s (total)':lambda r:f(r,'Solve time')*f(r,'Pause frac') if f(r,'Pause frac') is not None else None,
 'cross pause s':lambda r:f(r,'Cross pauses (s)'),
 'pre-F2L pause s':lambda r:f(r,'Pause before F2L (s)'),
 'F2L pauses s (incl pre)':lambda r:f(r,'F2L pauses (s)'),
 'LL pauses s':lambda r:f(r,'LL pauses (s)'),
 'regrips':lambda r:f(r,'Regrips'),
 'rotations':lambda r:f(r,'Rotations'),
 'cross moves':lambda r:f(r,'Cross moves'),
 'F2L moves':lambda r:f(r,'F2L moves'),
 'LL moves':lambda r:f(r,'LL moves'),
 'TPS no-pause':lambda r:f(r,'TPS without pauses'),
}
sel=[r for r in rows if f(r,'Solve time')<=30]
print("solves <=30s:",len(sel))
print(f"{'metric':26s} {'@18':>6s} {'@15':>6s} {'@12':>6s} {'r':>6s} n")
for k,fn in metrics.items():
    pts=[(f(r,'Solve time'),fn(r)) for r in sel if fn(r) is not None]
    a,b,r,n=fit([p[0] for p in pts],[p[1] for p in pts])
    print(f"{k:26s} {a+b*18:6.2f} {a+b*15:6.2f} {a+b*12:6.2f} {r:6.2f} {n}")

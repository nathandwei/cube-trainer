import csv, sys, statistics as st
from pathlib import Path
rows=list(csv.reader(Path(sys.argv[1]).open(), delimiter='\t'))[1:]
def num(x):
    try: return float(x)
    except: return None
data=[]
for r in rows:
    if len(r)<7: continue
    ao100=num(r[5]); ao12=num(r[4]); ms=num(r[1])
    sets={s.strip() for s in r[6].split(',') if s.strip()}
    data.append((ao100,ao12,ms,sets))
print("rows",len(data))
bands=[(0,10),(10,12),(12,14),(14,16),(16,18),(18,20),(20,25),(25,35)]
def has(sets,name): return name in sets
coll_sets=[s for s in ['COLL - T (Chameleon)','COLL - U (Headlights)','COLL - L (Bowtie)','COLL - H (Doublesune)','COLL - Pi (Bruno)','COLL - S (Sune)','COLL - AS (Antisune)']]
for key,idx in [('Ao100',0),('Ao12',1)]:
    print(f"\n=== by best {key} ===")
    for lo,hi in bands:
        b=[d for d in data if d[idx] is not None and lo<=d[idx]<hi]
        if len(b)<5: continue
        n=len(b)
        fo=sum(has(d[3],'OLL') for d in b)/n; fp=sum(has(d[3],'PLL') for d in b)/n
        anycoll=sum(any(c in d[3] for c in coll_sets) for d in b)/n
        fullcoll=sum(all(c in d[3] for c in coll_sets) for d in b)/n
        zbll=sum(has(d[3],'ZBLL') for d in b)/n
        ms=[d[2] for d in b if d[2] is not None]
        print(f"{lo:>2}-{hi:<2}s n={n:4d} fullOLL {fo:4.0%} fullPLL {fp:4.0%} anyCOLL {anycoll:4.0%} fullCOLL {fullcoll:4.0%} ZBLL {zbll:4.0%} median months speedcubing {st.median(ms) if ms else 'na'}")
all_sets=set().union(*[d[3] for d in data]); print("\nset names:", sorted(all_sets)[:60])

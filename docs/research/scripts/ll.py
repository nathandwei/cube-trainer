"""Last-layer enumeration with a cubie model (Kociemba conventions)."""
from itertools import permutations, product
from collections import Counter, defaultdict
from fractions import Fraction as Fr

class C:
    def __init__(s, cp, co, ep, eo): s.cp, s.co, s.ep, s.eo = list(cp), list(co), list(ep), list(eo)
    def __mul__(a, b):
        cp=[a.cp[b.cp[i]] for i in range(8)]; co=[(a.co[b.cp[i]]+b.co[i])%3 for i in range(8)]
        ep=[a.ep[b.ep[i]] for i in range(12)]; eo=[(a.eo[b.ep[i]]+b.eo[i])%2 for i in range(12)]
        return C(cp,co,ep,eo)
    def key(s): return (tuple(s.cp),tuple(s.co),tuple(s.ep),tuple(s.eo))
I=C(range(8),[0]*8,range(12),[0]*12)
M={
 'U':C([3,0,1,2,4,5,6,7],[0]*8,[3,0,1,2,4,5,6,7,8,9,10,11],[0]*12),
 'R':C([4,1,2,0,7,5,6,3],[2,0,0,1,1,0,0,2],[8,1,2,3,11,5,6,7,4,9,10,0],[0]*12),
 'F':C([1,5,2,3,0,4,6,7],[1,2,0,0,2,1,0,0],[0,9,2,3,4,8,6,7,1,5,10,11],[0,1,0,0,0,1,0,0,1,1,0,0]),
 'D':C([0,1,2,3,5,6,7,4],[0]*8,[0,1,2,3,5,6,7,4,8,9,10,11],[0]*12),
 'L':C([0,2,6,3,4,1,5,7],[0,1,2,0,0,2,1,0],[0,1,10,3,4,5,9,7,8,2,6,11],[0]*12),
 'B':C([0,1,3,7,4,5,2,6],[0,0,1,2,0,0,2,1],[0,1,2,11,4,5,6,10,8,9,3,7],[0,0,0,1,0,0,0,1,0,0,1,1]),
}
def apply(state, alg):
    for tok in alg.split():
        m=M[tok[0]]; n={'':1,"'":3,'2':2}[tok[1:]]
        for _ in range(n): state=state*m
    return state
# sanity: (R U R' U')x6 = I
s=I
for _ in range(6): s=apply(s,"R U R' U'")
assert s.key()==I.key()
s=apply(I,"R U R' U R U2 R'")
assert apply(s,"R U2 R' U' R U' R'").key()==I.key()

# LL states: corners 0-3, edges 0-3 permuted; orientation sums constrained; parity equal
def ll_states():
    for cpp in permutations(range(4)):
        for epp in permutations(range(4)):
            # parity
            def par(p): return sum(1 for i in range(4) for j in range(i+1,4) if p[i]>p[j])%2
            if par(cpp)!=par(epp): continue
            for co3 in product(range(3),repeat=3):
                co=list(co3)+[(-sum(co3))%3]
                for eo3 in product(range(2),repeat=3):
                    eo=list(eo3)+[sum(eo3)%2]
                    yield C(list(cpp)+[4,5,6,7],co+[0]*4,list(epp)+list(range(4,12)),eo+[0]*8)
S=list(ll_states()); print("LL states", len(S))
U=lambda s,n: apply(s,' '.join(['U']*n)) if n else s
def co_shape(s):
    # canonical corner-orientation pattern up to U rotation (pre-AUF) -> name
    co=tuple(s.co[:4]); return co
# name OCLL classes by orbit of CO pattern under U conjugation (pre-AUF y-rotations equivalent to AUF)
def orbit_co(s):
    pats=[]
    for k in range(4):
        t=U(s,k)
        pats.append(tuple(t.co[:4]))
    return min(pats)
# classify by applying known OCLL algs: find which alg+AUF orients corners
OCLL={
 'Sune':"R U R' U R U2 R'",
 'Antisune':"R U2 R' U' R U' R'",
 'H':"R U R' U R U' R' U R U2 R'",
 'Pi':"R U2 R2 U' R2 U' R2 U2 R",
 'U':"R2 D R' U2 R D' R' U2 R'",
 'T':"R U R D R' U' R D' R2",  # placeholder check below
 'L':"F R' F' L F R F' L'",
}
def oriented(s): return all(c==0 for c in s.co[:4])
def inv(alg):
    out=[]
    for tok in reversed(alg.split()):
        out.append(tok[0]+{'':"'","'":'','2':'2'}[tok[1:]])
    return ' '.join(out)
# build orbit -> name
orbit_name={}
for name,alg in OCLL.items():
    # state that alg solves = inverse(alg) applied to solved
    st=apply(I,inv(alg))
    o=orbit_co(st)
    orbit_name.setdefault(o,name)
corient = Counter()
for s in S:
    if s.eo[:4]!=[0,0,0,0]: continue
    o=orbit_co(s)
    corient[orbit_name.get(o,'skip' if oriented(s) or o==(0,0,0,0) else str(o))]+=1
tot=sum(corient.values()); print("EO-solved LL states", tot)
for k,v in corient.most_common(): print(f"  {k}: {Fr(v,tot)} = {v/tot:.4f}")
print("orbit names", orbit_name)

print("\n--- Sune-spam from U/T/L ---")
def shape(s): return orbit_name.get(orbit_co(s),'skip')
KNOWN={'Sune','Antisune','H','Pi','skip'}
SUNE="R U R' U R U2 R'"; ANTI="R U2 R' U' R U' R'"
def min_algs(s, algs, depth=4):
    frontier=[s]
    for d in range(1,depth+1):
        nxt=[]
        for t in frontier:
            for k in range(4):
                for a in algs:
                    r=apply(U(t,k),a)
                    if shape(r) in KNOWN: return d, shape(r)
                    nxt.append(r)
        frontier=nxt
    return None
for nm in ['U','T','L']:
    reps=[s for s in S if s.eo[:4]==[0]*4 and shape(s)==nm]
    res=Counter(); res2=Counter()
    # orientation-only: just need one representative per CO pattern; but outcome shape depends only on CO
    for s in reps[:200]:
        res[min_algs(s,[SUNE])]+=1; res2[min_algs(s,[SUNE,ANTI])]+=1
    print(nm, "Sune only:", dict(res), "| Sune or Antisune:", dict(res2))
# random-AUF Sune spam: expected number of Sunes (Markov chain over CO pattern)
import random
random.seed(1)
def spam(s):
    n=0
    while shape(s) not in KNOWN:
        s=apply(U(s,random.randrange(4)),SUNE); n+=1
    return n, shape(s)
for nm in ['U','T','L']:
    reps=[s for s in S if s.eo[:4]==[0]*4 and shape(s)==nm]
    trials=[spam(random.choice(reps)) for _ in range(20000)]
    print(nm,"random-AUF Sune spam: mean Sunes", sum(t[0] for t in trials)/len(trials), Counter(t[1] for t in trials))
# outcome of one Sune at each AUF
for nm in ['U','T','L']:
    s=[s for s in S if s.eo[:4]==[0]*4 and shape(s)==nm][0]
    print(nm, [shape(apply(U(s,k),SUNE)) for k in range(4)], "anti:",[shape(apply(U(s,k),ANTI)) for k in range(4)])

print("\n--- hold rule for one-Sune escape ---")
faces={0:('U','R','F'),1:('U','F','L'),2:('U','L','B'),3:('U','B','R')}
pos={0:'UFR',1:'UFL',2:'UBL',3:'UBR'}
def describe(s):
    return ' '.join(f"{pos[i]}:{faces[i][s.co[i]]}" for i in range(4))
for nm in ['U','T','L']:
    s=[s for s in S if s.eo[:4]==[0]*4 and shape(s)==nm][0]
    for k in range(4):
        t=U(s,k)
        r1=shape(apply(t,SUNE)); r2=shape(apply(t,ANTI))
        print(f"{nm} AUF{k}: yellow facing -> {describe(t)} | after Sune: {r1:9s} after Antisune: {r2}")

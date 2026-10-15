"""Expected last-layer cost per flow. All lengths STM (speed algs), estimates noted in report."""
from fractions import Fraction as Fr
def run(tps=7.5, r_eo=0.35, r_shape=0.35, r_coll=0.9, r_pll=0.7, r_epll=0.45, r_oll=0.6, unk_pen=1.5, coll_len=10.5, label=""):
    auf=0.75
    eo_moves=6.0               # E over EO cases incl. skip: (4*6+2*6+1*12)/8
    p_eo_alg=7/8
    ocll_len={'Sune':7,'Antisune':7,'H':11,'Pi':9,'U':9,'T':8,'L':8}
    p_shape={'Sune':4/27,'Antisune':4/27,'H':2/27,'Pi':4/27,'U':4/27,'T':4/27,'L':4/27,'skip':1/27}
    epll_len=(4*7+4*7+7+2*9)/11; p_epll=11/12
    pll_len=13.0; p_pll=71/72      # speed PLL ~13 STM (Speedsolving wiki); 919/71=12.9 from my alg list
    p_unknown_given_pll=24/71       # E,Na,Nb,V,G* = 24/72 of states, conditional on non-skip
    oll_len=9.7; p_oll=215/216
    def t(moves): return moves/tps
    eo = t(p_eo_alg*(eo_moves/p_eo_alg+auf)) + r_eo
    epll_after = t(p_epll*(epll_len+auf)) + r_epll + t(auf)       # incl final AUF
    pll_known_all = t(p_pll*(pll_len+auf)) + r_pll + t(auf)
    pll_13 = pll_known_all + p_pll*p_unknown_given_pll*unk_pen
    coll = t(coll_len+auf) + (r_coll - r_shape)
    sune_step = t(7+auf) + r_shape        # one Sune then re-read the shape
    out={}
    # A: current, correct hold (1 Sune) and random hold (2 Sunes expected)
    for nm,ns in [('A  current, Sune-spam w/ correct hold (1 Sune)',1),('A* current, Sune-spam random hold (~2 Sunes)',2)]:
        known=14/27; utl=12/27; skip=1/27
        LL = eo + r_shape + known*(coll+epll_after) + utl*(ns*sune_step+coll+epll_after) + skip*pll_13
        out[nm]=LL
    # B: learn U,T,L OCLL (3 algs); U/T/L -> OCLL + PLL (13 known PLLs, 2-look rest)
    ocll_utl=t((9+8+8)/3+auf)
    B = eo + r_shape + 14/27*(coll+epll_after) + 12/27*(ocll_utl+pll_13) + 1/27*pll_13
    out['B  +3 OCLL (U/T/L) -> PLL, 13 PLLs']=B
    Bp = eo + r_shape + 14/27*(coll+epll_after) + 12/27*(ocll_utl+pll_known_all) + 1/27*pll_known_all
    out["B' +3 OCLL +8 PLL (full PLL)"]=Bp
    # C: full COLL (+18)
    C = eo + r_shape + 26/27*(coll+epll_after) + 1/27*pll_13
    out['C  +18 COLL (full COLL), EPLL']=C
    # D0: 2-look OLL + full PLL (no COLL use)
    ocll_avg=sum(p_shape[k]*ocll_len[k] for k in ocll_len)/(26/27)
    D0 = eo + r_shape + t(26/27*(ocll_avg+auf)) + pll_known_all
    out['D0 2-look OLL + full PLL (no COLL)']=D0
    # D: full OLL + full PLL
    D = t(p_oll*(oll_len+auf)) + r_oll + pll_known_all
    out['D  full OLL + full PLL']=D
    # E: full OLL + full PLL, but COLL (full) when edges pre-oriented (1/8)
    E = 7/8*(t(oll_len+auf)+r_oll+pll_known_all) + 1/8*(r_shape + 26/27*(coll+epll_after) + 1/27*pll_known_all)
    out['E  full OLL/PLL + full COLL on OCLL cases']=E
    # Hybrid H: keep EO+COLL for known shapes, full OLL for non-oriented edges? (=E with partial COLL)
    print(f"\n== {label} tps={tps} r_coll={r_coll} r_pll={r_pll} coll_len={coll_len} unk_pen={unk_pen}")
    base=out['A* current, Sune-spam random hold (~2 Sunes)']
    for k,v in out.items(): print(f"  {k:48s} {v:5.2f} s   vs A*: {v-base:+.2f}")
    # looks
run(r_coll=0.85, label="base (COLL recog 0.85 total)")
run(r_coll=1.1, label="COLL recog 1.1 total")
run(tps=6.5, r_coll=1.2, r_pll=0.9, r_oll=0.8, label="slower recog/exec")
run(tps=8.5, r_coll=0.6, r_pll=0.5, r_oll=0.45, label="faster recog/exec")
# expected looks & moves table
def looks_moves():
    auf=0.75
    rows={}
    # A (correct hold)
    eo_l=1; 
    print("\nLooks (recognition events incl. skip checks) and moves (STM, incl. AUFs):")
    epll=(4*7+4*7+7+2*9)/11
    def m_epll(): return 11/12*(epll+auf)+auf
    def m_pll(): return 71/72*(13+auf)+auf
    A=6.0+7/8*auf + 14/27*(10.5+auf+m_epll()) + 12/27*(7+auf+10.5+auf+m_epll()) + 1/27*m_pll()
    As=6.0+7/8*auf + 14/27*(10.5+auf+m_epll()) + 12/27*(2*(7+auf)+10.5+auf+m_epll()) + 1/27*m_pll()
    C=6.0+7/8*auf + 26/27*(10.5+auf+m_epll()) + 1/27*m_pll()
    ocll=(4*7+4*7+2*11+4*9+4*9+4*8+4*8)/26
    D0=6.0+7/8*auf + 26/27*(ocll+auf) + m_pll()
    D=215/216*(9.7+auf)+m_pll()
    B=6.0+7/8*auf + 14/27*(10.5+auf+m_epll()) + 12/27*((25/3)+auf+m_pll()) + 1/27*m_pll()
    for k,v,l in [('A correct hold',A,1+1+12/27+1+1),('A* random hold',As,1+1+2*12/27+1+1),('B +3 OCLL +8 PLL',B,4),('C full COLL',C,4),('D0 2LOLL+PLL',D0,3),('D full OLL+PLL',D,2)]:
        print(f"  {k:20s} moves {v:5.1f}  looks {l:.2f}")
looks_moves()

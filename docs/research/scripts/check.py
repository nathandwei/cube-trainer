import importlib.util, sys, io, contextlib
from pathlib import Path
spec=importlib.util.spec_from_file_location("ll",Path(__file__).with_name("ll.py"))
m=importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(m)
fam=m.C(range(8),[2,0,2,2,0,0,0,0],range(12),[0]*12)
r=m.apply(fam,"R U R' U R U2 R'")
print("familiar after Sune co:", r.co[:4])
r2=m.apply(fam,"U' R U R' U R U2 R'")
print("familiar after U' Sune co:", r2.co[:4])
# single move check: R then trace co of a piece
x=m.apply(m.I,"R")
print("after R: cp",x.cp,"co",x.co)

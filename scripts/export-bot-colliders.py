"""Export conservative world-space collider boxes from this build's Paradise physics scenes.
Requires UnityPy; exports provenance and unsupported collider counts, never invents geometry.
"""
import zipfile,json,collections,itertools,math,sys
from pathlib import Path
import UnityPy
root=Path(__file__).resolve().parents[1]
obb=Path(sys.argv[1]);apk=Path(sys.argv[2]);out=Path(sys.argv[3])
a=zipfile.ZipFile(apk);z=zipfile.ZipFile(obb)
scenes=None
for o in UnityPy.load(a.read('assets/bin/Data/globalgamemanagers')).objects:
 if o.type.name=='BuildSettings':scenes=o.read_typetree()['scenes']
stats=collections.Counter();boxes=[]; mesh_files={}
def read_asset(filename):
 key='assets/bin/Data/'+filename
 for archive in (z,a):
  if key in archive.namelist():return archive.read(key)
  if key+'.split0' in archive.namelist():
   parts=[];i=0
   while key+'.split'+str(i) in archive.namelist():parts.append(archive.read(key+'.split'+str(i)));i+=1
   return b''.join(parts)
 raise KeyError(key)
def rot(p,q):
 x,y,z=p;u,v,w,t=(q[k] for k in ('x','y','z','w'))
 tx,ty,tz=2*(v*z-w*y),2*(w*x-u*z),2*(u*y-v*x)
 return (x+t*tx+v*tz-w*ty,y+t*ty+w*tx-u*tz,z+t*tz+u*ty-v*tx)
for i,name in enumerate(scenes):
 if '/PVP_Paradise/' not in name and i not in (5,9):continue
 env=UnityPy.load(read_asset('level'+str(i)))
 transforms={};bygo={};colliders=[]
 for o in env.objects:
  if o.type.name=='Transform':
   d=o.read_typetree();transforms[o.path_id]=d;bygo[d['m_GameObject']['m_PathID']]=o.path_id
  elif o.type.name.endswith('Collider'):
   stats[o.type.name]+=1;colliders.append((o.type.name,o.read_typetree(),o.assets_file))
 def world(p,tid):
  seen=set()
  while tid:
   if tid in seen:raise ValueError('Transform cycle')
   seen.add(tid);t=transforms[tid]
   p=rot(tuple(p[k]*t['m_LocalScale'][v] for k,v in enumerate('xyz')),t['m_LocalRotation'])
   p=tuple(p[k]+t['m_LocalPosition'][v] for k,v in enumerate('xyz'))
   tid=t['m_Father']['m_PathID']
  return p
 for typ,d,asset_file in colliders:
  if d.get('m_IsTrigger') or not d.get('m_Enabled',True):continue
  if typ=='BoxCollider':size=[d['m_Size'][k] for k in 'xyz']
  elif typ in ('SphereCollider','CapsuleCollider'):
   size=[2*d['m_Radius']]*3
   if typ=='CapsuleCollider':size[d['m_Direction']]=max(d['m_Height'],size[0])
  elif typ=='MeshCollider':
   ref=d['m_Mesh'];fid=ref['m_FileID']
   if fid:
    filename=asset_file.externals[fid-1].path.split('/')[-1]
    if filename not in mesh_files:
     mesh_env=UnityPy.load(read_asset(filename));mesh_files[filename]={o.path_id:o for o in mesh_env.objects}
    mesh=mesh_files[filename][ref['m_PathID']].read_typetree()
   else:mesh=asset_file.objects[ref['m_PathID']].read_typetree()
   bounds=mesh['m_LocalAABB'];d['m_Center']=bounds['m_Center'];size=[2*bounds['m_Extent'][k] for k in 'xyz']
   stats['meshBoundsExported']+=1
  else:stats['unsupportedSolid'+typ]+=1;continue
  tid=bygo[d['m_GameObject']['m_PathID']];c=d['m_Center']
  corners=[world(tuple(c[k]+sign[j]*size[j]/2 for j,k in enumerate('xyz')),tid) for sign in itertools.product((-1,1),repeat=3)]
  boxes.append({'min':{k:round(min(p[j] for p in corners),4) for j,k in enumerate('xyz')},'max':{k:round(max(p[j] for p in corners),4) for j,k in enumerate('xyz')}})
 stats['scenes']+=1
 if stats['scenes']%30==0:print(dict(stats),flush=True)
out.write_text(json.dumps({'source':obb.name,'map':'PVP_Paradise','stats':dict(stats),'obstacles':boxes},separators=(',',':')))
print('Exported',len(boxes),'bounds to',out,'stats',dict(stats))

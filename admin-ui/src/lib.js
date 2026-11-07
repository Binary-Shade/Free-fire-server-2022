import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn=(...x)=>twMerge(clsx(x));
export async function api(path, options={}) {
  const response=await fetch(`/admin/api${path}`,{credentials:'same-origin',...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...options.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||`Request failed (${response.status})`);error.status=response.status;throw error;}
  return data;
}

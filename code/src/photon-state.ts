import {openSync,closeSync,writeFileSync,readFileSync,fsyncSync,renameSync,unlinkSync,existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
/** All paths are private ignored operational state. A crashed lock is deliberately not auto-cleared. */
export async function withPhotonLock<T>(path:string,operation:()=>Promise<T>):Promise<T>{
  mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const fd=openSync(path,'wx',0o600);closeSync(fd);
  try{return await operation();}finally{unlinkSync(path);}
}
export function readPrivate<T>(path:string):T|undefined {return existsSync(path)?JSON.parse(readFileSync(path,'utf8')) as T:undefined;}
export function writePrivate(path:string,value:unknown):void {
  mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const temp=`${path}.${randomUUID()}.tmp`;let fd:number|undefined;
  try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,path);const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}}
  finally{if(fd!==undefined)closeSync(fd);if(existsSync(temp))unlinkSync(temp);}
}

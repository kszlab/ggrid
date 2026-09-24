import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const workDir=process.env.GGRID_WORK_DIR||path.join(root,'.cache','multiball-v2');
export function workFile(name){fs.mkdirSync(workDir,{recursive:true});return path.join(workDir,name);}

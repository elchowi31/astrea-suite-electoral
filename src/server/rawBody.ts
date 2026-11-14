import {Buffer} from 'node:buffer';
import {AgentError} from '../lib/requestAgent.js';
/** Apply the same byte limit to parsed runtime buffers and streamed requests. */
export async function boundedRawBody(req:AsyncIterable<unknown>&{rawBody?:Buffer},maximum:number,label:string){
 if(Buffer.isBuffer(req.rawBody)){
  if(req.rawBody.byteLength>maximum)throw new AgentError(`${label} excede el tamaño permitido.`,413);
  return req.rawBody;
 }
 const parts:Buffer[]=[];let size=0;
 for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as string);size+=bytes.byteLength;if(size>maximum)throw new AgentError(`${label} excede el tamaño permitido.`,413);parts.push(bytes);}
 return Buffer.concat(parts);
}

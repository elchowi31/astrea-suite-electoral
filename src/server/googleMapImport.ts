export function googleMapId(link:string):string{
  let url:URL;try{url=new URL(link);}catch{throw new Error('El enlace de My Maps no es válido.');}
  if(url.protocol!=='https:'||!['www.google.com','google.com'].includes(url.hostname)||url.port||url.username||url.password||!/^\/maps\/d\/(?:u\/\d+\/)?kml$/.test(url.pathname))throw new Error('Solo se admiten enlaces KML de Google My Maps.');
  const id=url.searchParams.get('mid')||'';if(!/^[A-Za-z0-9_-]{10,160}$/.test(id))throw new Error('Identificador de mapa inválido.');return id;
}
export async function fetchGoogleMapKml(link:string,fetcher:typeof fetch=fetch):Promise<string>{
  const id=googleMapId(link),url=`https://www.google.com/maps/d/kml?forcekml=1&mid=${encodeURIComponent(id)}`;
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/vnd.google-earth.kml+xml,application/xml'}});
  if(!response.ok)throw new Error('No se pudo leer el mapa. Hágalo accesible mediante enlace o exporte un KML/KMZ con sus geometrías.');
  if(Number(response.headers.get('content-length')||0)>10*1024*1024)throw new Error('El mapa supera 10 MB.');
  const reader=response.body?.getReader();if(!reader)throw new Error('El mapa no devolvió contenido.');
  const chunks:Uint8Array[]=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>10*1024*1024)throw new Error('El mapa supera 10 MB.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const xml=new TextDecoder().decode(bytes);if(!/<(?:\w+:)?kml(?:\s|>)/i.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Google no devolvió un KML. Revise el acceso al mapa.');return xml;
}

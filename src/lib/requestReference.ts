/** Display reference only; persistence, permissions and deduplication use the full id. */
export function requestReference(id:string):string {
  const match=/^agent-[\w-]+-([a-f0-9]{64})$/.exec(id);
  return match?'REQ-'+match[1].slice(0,20).toUpperCase().match(/.{5}/g)!.join('-'):id;
}

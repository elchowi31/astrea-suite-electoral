export type SubscriptionHealth={collection:string;tenantId:string;userId:string;state:'loading'|'ready'|'error'|'partial';count?:number;durationMs?:number;code?:string};
export function notifySubscriptionHealth(value:SubscriptionHealth){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('astrea:data-health',{detail:value}));
}

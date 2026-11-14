/** Shared contract for free-draw delivery. No Firebase or electoral dependencies. */
export type RewardLocation={latitude:number;longitude:number;accuracyMeters:number;capturedAt:string;source:'device_geolocation';confirmedForDelivery:true};
export type RewardDelivery={
 address:{countryCode:'CO';department:string;municipality:string;line1:string;neighborhood?:string;instructions?:string};
 consent:{accepted:true;purpose:'reward_delivery';policyVersion:string;acceptedAt:string;scopes:('address'|'location')[]};
 location?:RewardLocation;
};
export function deliveryAddress(delivery?:RewardDelivery){
 return delivery?[delivery.address.line1,delivery.address.neighborhood,delivery.address.municipality,delivery.address.department,'Colombia'].filter(Boolean).join(', '):'';
}
export function deliveryMapsUrl(delivery:RewardDelivery){
 const destination=delivery.location?`${delivery.location.latitude},${delivery.location.longitude}`:deliveryAddress(delivery);
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
export async function captureRewardLocation(options:{consented:boolean;geolocation?:Pick<Geolocation,'getCurrentPosition'>;now?:()=>number}):Promise<Omit<RewardLocation,'confirmedForDelivery'>>{
 if(!options.consented)throw new Error('Autorice el uso de la ubicación para la entrega antes de capturarla.');
 const geo=options.geolocation??globalThis.navigator?.geolocation;
 if(!geo)throw new Error('Este dispositivo no permite obtener la ubicación. Puede escribir su dirección.');
 return new Promise((resolve,reject)=>geo.getCurrentPosition(position=>{
  const {latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>100000){reject(new Error('No se pudo obtener una ubicación válida. Intente de nuevo o escriba su dirección.'));return;}
  resolve({latitude,longitude,accuracyMeters:accuracy,capturedAt:new Date((options.now??Date.now)()).toISOString(),source:'device_geolocation'});
 },error=>reject(new Error(error.code===1?'No se autorizó la ubicación. Puede continuar escribiendo su dirección.':error.code===3?'La ubicación tardó demasiado. Intente de nuevo o escriba su dirección.':'No se pudo obtener la ubicación. Puede continuar con su dirección.')),{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}

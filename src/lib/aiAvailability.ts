/** Bounded retries apply only to temporary provider failures; credentials fail immediately. */
export async function withAvailableModel<T>(models: string[], request: (model: string) => Promise<T>, pause: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))): Promise<T> {
  const choices=[...new Set(models.map(model=>model.trim()).filter(Boolean))].slice(0,2);
  for (const model of choices) {
    for (let attempt=0;attempt<2;attempt++) {
      try { return await request(model); }
      catch(error) {
        const status=Number((error as {status?:number;code?:number})?.status || (error as {code?:number})?.code);
        const temporary=[429,500,502,503,504].includes(status) || (error as {name?:string})?.name==='AbortError';
        if (!temporary) throw error;
        if (attempt===0) await pause(700);
      }
    }
  }
  throw new Error('AI_SERVICE_UNAVAILABLE');
}

/** Shared categorical colors, chosen for contrast against Astrea's navy surfaces. */
export const CHART_COLORS = ['#22d3ee','#a78bfa','#fbbf24','#34d399','#fb7185','#60a5fa','#fb923c','#e879f9','#a3e635','#2dd4bf','#f472b6','#c4b5fd','#fde047','#38bdf8'];
export function categoryColor(index: number): string { return CHART_COLORS[index % CHART_COLORS.length]; }
/** Sorting the full category domain keeps colors stable when values or filters change. */
export function categoryColors(names: readonly string[]): Record<string,string> {
  return Object.fromEntries([...new Set(names)].sort((a,b)=>a.localeCompare(b,'es')).map((name,index)=>[name,categoryColor(index)]));
}

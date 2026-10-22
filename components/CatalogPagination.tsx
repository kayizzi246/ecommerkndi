import Link from "next/link";
export default function CatalogPagination({page,totalPages,path,params={}}:{page:number;totalPages:number;path:string;params?:Record<string,string|undefined>}) {
  if(totalPages<2)return null;
  const url=(number:number)=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(params))if(key!=="page"&&value)query.set(key,value);if(number>1)query.set("page",String(number));return path+(query.size?"?"+query.toString():"");};
  const numbers=[...new Set([1,page-1,page,page+1,totalPages])].filter(n=>n>0&&n<=totalPages).sort((a,b)=>a-b);
  return <nav aria-label="Product pages" className="phone-gutter my-5 flex flex-wrap items-center justify-center gap-2 text-[12px]">
    {page>1&&<Link prefetch={false} href={url(page-1)} className="rounded-lg border border-shop-line bg-white px-3 py-2">Previous</Link>}
    {numbers.map((number,index)=><span key={number} className="inline-flex items-center gap-2">{index>0&&number-numbers[index-1]>1&&<span aria-hidden>&hellip;</span>}<Link prefetch={false} href={url(number)} aria-current={number===page?"page":undefined} aria-label={"Page "+number} className={"rounded-lg border px-3 py-2 "+(number===page?"border-shop-ink bg-shop-ink text-white":"border-shop-line bg-white text-shop-ink")}>{number}</Link></span>)}
    {page<totalPages&&<Link prefetch={false} href={url(page+1)} className="rounded-lg border border-shop-line bg-white px-3 py-2">Next</Link>}
  </nav>;
}

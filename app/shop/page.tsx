import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsSafe } from "@/lib/woocommerce";
import { absolute,cataloguePage,listingPath,collectionJsonLd,breadcrumbJsonLd } from "@/lib/seo";
import InfiniteProducts from "@/components/home/InfiniteProducts";
import CatalogPagination from "@/components/CatalogPagination";
type Search={page?:string};
export async function generateMetadata({searchParams}:{searchParams:Promise<Search>}):Promise<Metadata>{const page=cataloguePage((await searchParams).page);const title="Shop All Products in Uganda"+(page>1?" - Page "+page:"");const description="Browse shoes, clothing, home essentials and more at KandiUg. Compare prices in Uganda shillings, discover current offers and choose delivery at checkout.";return {title,description,alternates:{canonical:absolute(listingPath("/shop",page))},openGraph:{title,description,url:absolute(listingPath("/shop",page))}};}
export default async function Shop({searchParams}:{searchParams:Promise<Search>}){
 const page=cataloguePage((await searchParams).page);const {products,total,total_pages}=await getProductsSafe({page,per_page:48});if(page>1&&products.length===0)notFound();
 return <main className="mx-auto w-full max-w-[var(--shell)] px-2 py-5 md:px-8">
 <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify([breadcrumbJsonLd([{name:"Home",path:"/"},{name:"Shop all products",path:"/shop"}]),collectionJsonLd("Shop all products in Uganda",listingPath("/shop",page),products)]).replace(/</g,String.fromCharCode(92)+"u003c")}}/>
 <div className="mb-5"><p className="text-[12px] text-shop-muted"><Link href="/">Home</Link> / Shop</p><h1 className="mt-2 text-[24px] font-bold">Shop all products in Uganda</h1><p className="mt-2 max-w-3xl text-[13px] text-shop-body">Explore shoes, clothing, home essentials and everyday finds. Compare prices in UGX and see delivery options before paying.</p><p className="mt-2 text-[12px] text-shop-muted">{total} products &middot; Page {page} of {Math.max(1,total_pages)}</p><div className="mt-3 flex gap-4 text-[12px] font-semibold"><Link href="/categories">Browse categories</Link><Link href="/sale">Shop current offers</Link></div></div>
 <CatalogPagination page={page} totalPages={total_pages} path="/shop"/><InfiniteProducts key={page} initialProducts={products} totalPages={total_pages} perPage={48} startPage={page}/><CatalogPagination page={page} totalPages={total_pages} path="/shop"/>
 </main>;
}

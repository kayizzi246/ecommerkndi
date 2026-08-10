import { redirect } from "next/navigation";

/** The admin area is the product manager, so /admin lands straight on it. */
export default function AdminIndexPage() {
  redirect("/admin/products");
}

import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav email={session.email} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

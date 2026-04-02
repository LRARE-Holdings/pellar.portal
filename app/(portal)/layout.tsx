import { Sidebar } from "@/components/sidebar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-cream p-8">{children}</main>
    </div>
  );
}

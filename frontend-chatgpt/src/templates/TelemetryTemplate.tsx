import type { ReactNode } from "react";

import MenuSidebar from "@/src/domains/menu/MenuSidebar";

type TelemetryTemplateProps = {
  children: ReactNode;
};

export default function TelemetryTemplate({
  children,
}: TelemetryTemplateProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="h-14 border-b bg-white" />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-64 border-r bg-white p-3">
          <MenuSidebar />
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

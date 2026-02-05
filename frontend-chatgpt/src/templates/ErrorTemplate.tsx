import type { ReactNode } from "react";

type ErrorTemplateProps = {
  children: ReactNode;
};

export default function ErrorTemplate({ children }: ErrorTemplateProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="h-14 border-b bg-white" />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center px-6">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}

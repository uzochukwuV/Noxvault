"use client";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm leading-7 text-zinc-300">{subtitle}</p> : null}
      </div>
      <div className="mt-8 grid gap-8">{children}</div>
    </div>
  );
}


export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-semibold text-foreground">Host Dashboard</p>
        {children}
      </div>
    </div>
  );
}

export function AuthLayout({
  hero,
  children,
}: {
  hero: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#18181b] p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl lg:grid-cols-2">
        <div className="hidden lg:block">{hero}</div>
        <div className="flex items-center justify-center px-6 py-12 sm:px-12 sm:py-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

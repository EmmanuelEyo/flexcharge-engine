export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex text-on-surface antialiased">
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-container-highest overflow-hidden">
        <img alt="Abstract 3D geometric network with glowing lines in dark blue, representing secure digital payments and connectivity." className="absolute inset-0 w-full h-full object-cover" src="/auth-image.jpg" />
        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 to-transparent" />
        <div className="relative z-10 p-8 flex flex-col justify-end w-full h-full">
          <h1 className="text-[48px] leading-[56px] tracking-[-0.02em] font-bold text-on-primary max-w-lg">
            Join the next generation of African payments.
          </h1>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-4 py-6 sm:px-8 bg-surface">
        {children}
      </div>
    </div>
  );
}

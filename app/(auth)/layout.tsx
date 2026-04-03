import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8">
        <Logo height={30} href="/" />
      </div>
      {children}
      <p className="mt-8 text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Get More Hours. All rights reserved.
      </p>
    </div>
  );
}

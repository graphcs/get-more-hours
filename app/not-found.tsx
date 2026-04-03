import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8">
        <Logo height={28} href="/" />
      </div>
      <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Page Not Found
      </h2>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button variant="outline">Go Home</Button>
        </Link>
        <Link href="/dashboard">
          <Button>Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

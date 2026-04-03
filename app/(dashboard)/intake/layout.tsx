import { Logo } from "@/components/logo";

export default function IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-7 py-3 flex items-center justify-between">
        <Logo height={24} href="/" />
        <span className="text-sm text-gray-500">
          Need help? Call{" "}
          <a
            href="tel:2125550123"
            className="text-primary font-medium hover:underline"
          >
            (212) 555-0123
          </a>
        </span>
      </div>
      <div className="max-w-[680px] mx-auto px-5 py-8 pb-24">{children}</div>
    </div>
  );
}

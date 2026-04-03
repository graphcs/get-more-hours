import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  href?: string;
  height?: number;
  className?: string;
}

export function Logo({ href = "/", height = 28, className }: LogoProps) {
  const img = (
    <Image
      src="/logo.svg"
      alt="Get More Hours"
      width={Math.round(height * (589 / 61))}
      height={height}
      className={className}
      priority
    />
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center">
        {img}
      </Link>
    );
  }

  return img;
}

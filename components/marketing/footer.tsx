import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t py-12 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <Logo height={22} href="/" />
            </div>
            <p className="text-sm text-muted-foreground">
              Helping NY seniors get the home care hours they deserve.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/services" className="hover:text-foreground">
                  Request for Increase
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-foreground">
                  Internal Appeal
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-foreground">
                  Fair Hearing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/testimonials" className="hover:text-foreground">
                  Testimonials
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>info@getmorehours.com</li>
              <li>(212) 555-0123</li>
              <li>New York, NY</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Get More Hours. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

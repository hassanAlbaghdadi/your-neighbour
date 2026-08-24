"use client";

import Link from "next/link";
import Image from "next/image";
import { InstagramIcon } from "@/components/icons/instagram-icon";
import { scrollToAnchor } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/social";

interface SiteFooterProps {
  businessName: string;
  contactEmail: string;
  categories: { id: string; name: string }[];
}

export function SiteFooter({
  businessName,
  contactEmail,
  categories,
}: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-espresso-900 text-cream-50 print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/brand/mark-white.png"
              alt=""
              width={28}
              height={28}
            />
            <span className="font-heading text-lg font-semibold">
              {businessName}
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-cream-50/70">
            Small-batch baked goods, made to order for local pickup.
          </p>
        </div>

        {categories.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wider text-cream-50/50 uppercase">
              Menu
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href="/#menu"
                    onClick={(e) => scrollToAnchor(e, "menu")}
                    className="text-cream-50/80 transition-colors hover:text-cream-50"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {contactEmail && (
          <div>
            <p className="text-xs font-semibold tracking-wider text-cream-50/50 uppercase">
              Questions
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="mt-3 block text-sm text-cream-50/80 transition-colors hover:text-cream-50"
            >
              {contactEmail}
            </a>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold tracking-wider text-cream-50/50 uppercase">
            Follow
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("instagram_click", { location: "footer" })}
            className="mt-3 flex items-center gap-1.5 text-sm text-cream-50/80 transition-colors hover:text-cream-50"
          >
            <InstagramIcon className="size-4" />
            {INSTAGRAM_HANDLE}
          </a>
        </div>
      </div>

      <div className="border-t border-cream-50/10 px-4 py-4 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs text-cream-50/50">
          © {year} {businessName}. Local pickup only.
        </p>
      </div>
    </footer>
  );
}

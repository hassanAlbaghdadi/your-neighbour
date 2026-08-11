import Link from "next/link";

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
    <footer className="bg-espresso-900 text-cream-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="font-heading text-lg font-semibold">{businessName}</p>
          <p className="mt-2 max-w-xs text-sm text-cream-50/70">
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
      </div>

      <div className="border-t border-cream-50/10 px-4 py-4 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs text-cream-50/50">
          © {year} {businessName}. Local pickup only.
        </p>
      </div>
    </footer>
  );
}

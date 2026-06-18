import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getProduct,
  getProductModel,
  getVariants,
  getFamilyAttributes,
  getAttributeGroups,
  getFamily,
  resolveValue,
  mediaUrl,
  LOCALE,
  SCOPE,
  type Product,
  type ProductModel,
  type AkeneoAttribute,
  type AkeneoAttributeGroup,
} from '@/lib/akeneo';

// ── Helpers ────────────────────────────────────────────────────────────────

function attrLabel(attr: AkeneoAttribute, locale: string): string {
  return attr.labels[locale] ?? attr.labels['en_US'] ?? attr.code;
}

function formatValue(attr: AkeneoAttribute, raw: unknown, locale: string): string | null {
  if (raw === null || raw === undefined) return null;

  switch (attr.type) {
    case 'pim_catalog_boolean':
      return raw ? 'Yes' : 'No';

    case 'pim_catalog_metric': {
      const m = raw as { amount: number; unit: string };
      return `${m.amount} ${m.unit}`;
    }

    case 'pim_catalog_price_collection': {
      const prices = raw as Array<{ amount: number; currency: string }>;
      return prices.map(p => `${p.amount} ${p.currency}`).join(' · ');
    }

    case 'pim_catalog_simpleselect':
    case 'pim_catalog_multiselect': {
      if (Array.isArray(raw)) return (raw as string[]).join(', ');
      return String(raw);
    }

    case 'pim_catalog_date':
      return new Date(raw as string).toLocaleDateString(locale.replace('_', '-'));

    case 'pim_catalog_file':
    case 'pim_catalog_image':
      return null; // handled separately as image

    case 'pim_catalog_textarea':
    case 'pim_catalog_text':
    default:
      return typeof raw === 'string' ? raw : JSON.stringify(raw);
  }
}

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ sku: string }> }
): Promise<Metadata> {
  const { sku } = await params;
  try {
    const product = await getProduct(sku);
    const label = resolveValue(product.values['name'], LOCALE, SCOPE)
      ?? resolveValue(product.values['label'], LOCALE, SCOPE)
      ?? product.identifier;
    return { title: `${label} — Product Viewer` };
  } catch {
    return { title: 'Product not found' };
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function ProductPage(
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku } = await params;

  // 1. Fetch product
  let product: Product;
  try {
    product = await getProduct(sku);
  } catch {
    notFound();
  }

  // 2. Resolve parent model (if variant)
  let parentModel: ProductModel | null = null;
  if (product.parent) {
    try { parentModel = await getProductModel(product.parent); } catch { /* ok */ }
  }

  // 3. Resolve siblings (other variants of same parent)
  let variants: Product[] = [];
  if (product.parent) {
    try { variants = await getVariants(product.parent); } catch { /* ok */ }
  }

  // 4. Attributes + groups
  const familyCode = product.family ?? parentModel?.family ?? '';
  const [attrMap, groups, family] = await Promise.all([
    familyCode ? getFamilyAttributes(familyCode) : Promise.resolve(new Map<string, AkeneoAttribute>()),
    getAttributeGroups(),
    familyCode ? getFamily(familyCode).catch(() => null) : Promise.resolve(null),
  ]);

  // 5. Merge product values with parent model values (parent holds common attrs)
  const mergedValues = {
    ...(parentModel?.values ?? {}),
    ...product.values,
  };

  // 6. Resolve display label
  const productLabel =
    String(resolveValue(mergedValues['name'], LOCALE, SCOPE) ?? '')  ||
    String(resolveValue(mergedValues['label'], LOCALE, SCOPE) ?? '') ||
    String(resolveValue(mergedValues['title'], LOCALE, SCOPE) ?? '') ||
    product.identifier;

  // 7. Collect images (pim_catalog_image attributes + attribute_as_image)
  const imageUrls: string[] = [];
  const imageAttrCodes = new Set<string>();
  if (family?.attribute_as_image) imageAttrCodes.add(family.attribute_as_image);
  for (const [code, attr] of attrMap) {
    if (attr.type === 'pim_catalog_image') imageAttrCodes.add(code);
  }
  for (const code of imageAttrCodes) {
    const raw = resolveValue(mergedValues[code], LOCALE, SCOPE);
    const url = mediaUrl(raw);
    if (url) imageUrls.push(url);
  }

  // 8. Group attributes for display (skip images and internal attrs)
  const SKIP_TYPES = new Set(['pim_catalog_image', 'pim_catalog_file', 'pim_assets_collection']);
  const SKIP_CODES = new Set(['sku', 'identifier']);

  type GroupRow = { group: AkeneoAttributeGroup; rows: { label: string; value: string }[] };
  const groupedAttrs: GroupRow[] = [];

  const sortedGroups = [...groups].filter(g =>
    g.attributes.some(code => mergedValues[code] !== undefined)
  );

  for (const group of sortedGroups) {
    const rows: { label: string; value: string }[] = [];
    for (const code of group.attributes) {
      if (SKIP_CODES.has(code)) continue;
      const attr = attrMap.get(code);
      if (!attr || SKIP_TYPES.has(attr.type)) continue;
      const raw = resolveValue(mergedValues[code], LOCALE, SCOPE);
      const formatted = formatValue(attr, raw, LOCALE);
      if (!formatted) continue;
      rows.push({ label: attrLabel(attr, LOCALE), value: formatted });
    }
    if (rows.length) groupedAttrs.push({ group, rows });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 flex items-center gap-1.5">
        <span>Products</span>
        {product.categories[0] && <><span>/</span><span className="capitalize">{product.categories[0].replace(/_/g, ' ')}</span></>}
        <span>/</span>
        <span className="text-gray-600 font-medium truncate max-w-xs">{productLabel}</span>
      </nav>

      {/* Hero: images + title */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* Image gallery */}
        <div className="space-y-3">
          {imageUrls.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[0]}
                alt={productLabel}
                className="w-full aspect-square object-contain rounded-2xl border border-gray-200 bg-white p-4"
              />
              {imageUrls.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {imageUrls.slice(1).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`${productLabel} ${i + 2}`}
                      className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-white">
              <span className="text-gray-300 text-sm">No image</span>
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div className="space-y-5">
          <div>
            {family && (
              <span className="inline-block text-xs font-medium text-brand-600 bg-brand-50 rounded-full px-2.5 py-0.5 mb-2">
                {family.labels[LOCALE] ?? familyCode}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              {productLabel}
            </h1>
            <p className="mt-1 text-sm text-gray-400 font-mono">SKU: {product.identifier}</p>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              product.enabled
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${product.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              {product.enabled ? 'Active' : 'Inactive'}
            </span>
            {product.categories.length > 0 && (
              <span className="text-xs text-gray-400">
                {product.categories.length} {product.categories.length === 1 ? 'category' : 'categories'}
              </span>
            )}
          </div>

          {/* Short description if available */}
          {(() => {
            const desc =
              resolveValue(mergedValues['description'], LOCALE, SCOPE) ??
              resolveValue(mergedValues['short_description'], LOCALE, SCOPE);
            if (!desc || typeof desc !== 'string') return null;
            return (
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-6"
                 dangerouslySetInnerHTML={{ __html: desc }} />
            );
          })()}

          {/* Variants selector */}
          {variants.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Variants ({variants.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {variants.map(v => (
                  <a
                    key={v.uuid}
                    href={`/products/${v.identifier}`}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                      v.identifier === product.identifier
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-400 hover:text-brand-600'
                    }`}
                  >
                    {v.identifier}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {product.categories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categories</p>
              <div className="flex flex-wrap gap-1.5">
                {product.categories.map(cat => (
                  <span key={cat} className="text-xs bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">
                    {cat.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attribute groups */}
      {groupedAttrs.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
            Product Details
          </h2>
          {groupedAttrs.map(({ group, rows }) => (
            <div key={group.code}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {group.labels[LOCALE] ?? group.code}
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {rows.map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-4 py-3 text-sm">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <span className="col-span-1 sm:col-span-2 text-gray-800 break-words">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-bold text-gray-800 mb-3">Product Viewer</h1>
      <p className="text-gray-500 text-sm">
        Open a shared product link to view its details.
      </p>
      <p className="mt-2 text-gray-400 text-xs font-mono">
        /products/&#123;sku&#125;
      </p>
    </div>
  );
}

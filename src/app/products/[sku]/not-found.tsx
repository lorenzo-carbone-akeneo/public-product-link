export default function ProductNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">📦</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Product not found</h2>
      <p className="text-gray-500 text-sm">
        This product may have been removed or the link is incorrect.
      </p>
    </div>
  );
}

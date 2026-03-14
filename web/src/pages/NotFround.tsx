export default function NotFround() {
  return (
    <div className="min-h-svh">
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-4xl">404</p>
          <h1 className="text-xl font-semibold text-white">
            ページが見つかりません
          </h1>
          <p className="text-gray-400 max-w-sm">
            お探しのページは存在しないか、移動した可能性があります。
          </p>
          <a
            href="/"
            className="inline-block mt-4 text-sm text-blue-400 hover:underline"
          >
            トップに戻る
          </a>
        </div>
      </div>
    </div>
  );
}

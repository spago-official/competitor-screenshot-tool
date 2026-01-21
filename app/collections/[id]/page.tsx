'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';

interface Screenshot {
  id: string;
  imagePath: string;
  title: string | null;
  url: string;
  capturedAt: string;
}

interface TargetUrl {
  id: string;
  url: string;
  source: string;
  status: string;
  errorMessage: string | null;
  screenshots: Screenshot[];
}

interface CollectionStats {
  total: number;
  done: number;
  failed: number;
  pending: number;
}

interface Collection {
  id: string;
  title: string;
  queryText: string;
  status: string;
  createdAt: string;
  targetUrls: TargetUrl[];
  stats: CollectionStats;
}

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [urlsText, setUrlsText] = useState('');
  const [addingUrls, setAddingUrls] = useState(false);
  const [message, setMessage] = useState('');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetchCollection();
    // 定期的に更新（進捗確認用）
    const interval = setInterval(fetchCollection, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchCollection() {
    try {
      const response = await fetch(`/api/collections/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      } else {
        console.error('Failed to fetch collection');
      }
    } catch {
      console.error('Failed to fetch collection');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUrls() {
    if (!urlsText.trim()) {
      setMessage('URLを入力してください');
      return;
    }

    setAddingUrls(true);
    setMessage('');

    // 改行区切りでURLを抽出
    const urls = urlsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'));

    if (urls.length === 0) {
      setMessage('有効なURLが見つかりませんでした（http/httpsで始まる必要があります）');
      setAddingUrls(false);
      return;
    }

    try {
      const response = await fetch(`/api/collections/${id}/urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(
          `${data.added}件のURLを追加しました（${data.skipped}件はスキップ）`
        );
        setUrlsText('');
        await fetchCollection();
      } else {
        const data = await response.json();
        setMessage(data.error || 'URLの追加に失敗しました');
      }
    } catch {
      setMessage('ネットワークエラーが発生しました');
    } finally {
      setAddingUrls(false);
    }
  }

  async function handleTrigger() {
    if (!confirm('失敗したURLを再試行しますか？')) {
      return;
    }

    setTriggering(true);

    try {
      const response = await fetch(`/api/collections/${id}/trigger`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        await fetchCollection();
      } else {
        const data = await response.json();
        alert(data.error || '再試行の開始に失敗しました');
      }
    } catch {
      alert('ネットワークエラーが発生しました');
    } finally {
      setTriggering(false);
    }
  }

  function handleDownload() {
    window.open(`/api/collections/${id}/download`, '_blank');
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      PENDING: 'bg-gray-200 text-gray-700',
      RUNNING: 'bg-blue-200 text-blue-700',
      DONE: 'bg-green-200 text-green-700',
      FAILED: 'bg-red-200 text-red-700',
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          styles[status] || 'bg-gray-200 text-gray-700'
        }`}
      >
        {status}
      </span>
    );
  }

  function getSourceBadge(source: string) {
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          source === 'AUTO'
            ? 'bg-purple-200 text-purple-700'
            : 'bg-orange-200 text-orange-700'
        }`}
      >
        {source}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-red-600">コレクションが見つかりませんでした</div>
      </div>
    );
  }

  const progressPercentage =
    collection.stats.total === 0
      ? 0
      : Math.round(
          ((collection.stats.done + collection.stats.failed) /
            collection.stats.total) *
            100
        );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
          >
            ← 戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {collection.title}
          </h1>
        </div>

        {/* 進捗サマリー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">進捗状況</h2>
            <div className="flex gap-3">
              <button
                onClick={handleTrigger}
                disabled={triggering || collection.stats.failed === 0}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {triggering ? '処理中...' : `失敗したURLを再試行 (${collection.stats.failed})`}
              </button>
              <button
                onClick={handleDownload}
                disabled={collection.stats.done === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                Download ZIP ({collection.stats.done})
              </button>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">全体進捗</span>
              <span className="text-gray-600">
                {collection.stats.done + collection.stats.failed} /{' '}
                {collection.stats.total} ({progressPercentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {collection.stats.total}
              </div>
              <div className="text-sm text-gray-600">総数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {collection.stats.done}
              </div>
              <div className="text-sm text-gray-600">完了</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {collection.stats.failed}
              </div>
              <div className="text-sm text-gray-600">失敗</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {collection.stats.pending}
              </div>
              <div className="text-sm text-gray-600">待機中</div>
            </div>
          </div>
        </div>

        {/* URL手動追加 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            URL手動追加
          </h2>
          <textarea
            value={urlsText}
            onChange={e => setUrlsText(e.target.value)}
            placeholder="URLを改行区切りで入力してください&#10;例:&#10;https://example.com&#10;https://competitor.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 mb-3"
            rows={4}
            disabled={addingUrls}
          />
          <button
            onClick={handleAddUrls}
            disabled={addingUrls}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {addingUrls ? '追加中...' : 'Add URLs'}
          </button>
          {message && (
            <p
              className={`mt-2 text-sm ${
                message.includes('失敗') || message.includes('エラー')
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}
            >
              {message}
            </p>
          )}
        </div>

        {/* URL一覧 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            URL一覧 ({collection.targetUrls.length})
          </h2>

          {collection.targetUrls.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              まだURLがありません
            </div>
          ) : (
            <div className="space-y-3">
              {collection.targetUrls.map(targetUrl => (
                <div
                  key={targetUrl.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <a
                        href={targetUrl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {targetUrl.url}
                      </a>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {getSourceBadge(targetUrl.source)}
                      {getStatusBadge(targetUrl.status)}
                    </div>
                  </div>

                  {targetUrl.screenshots.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      ✓ スクリーンショット取得済み
                      {targetUrl.screenshots[0].title && (
                        <span> - {targetUrl.screenshots[0].title}</span>
                      )}
                    </div>
                  )}

                  {targetUrl.errorMessage && (
                    <div className="mt-2 text-sm text-red-600">
                      エラー: {targetUrl.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

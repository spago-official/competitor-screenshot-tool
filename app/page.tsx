'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  stats: CollectionStats;
}

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCollections();
    // 定期的に更新（進捗確認用）
    const interval = setInterval(fetchCollections, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCollections() {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch {
      console.error('Failed to fetch collections');
    }
  }

  async function handleCollect() {
    if (!queryText.trim()) {
      setError('コレクション名を入力してください');
      return;
    }

    // 英数字、ハイフン、アンダースコアのみ許可
    const validPattern = /^[a-zA-Z0-9-_]+$/;
    if (!validPattern.test(queryText.trim())) {
      setError('コレクション名は半角英数字、ハイフン、アンダースコアのみ使用できます');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryText: queryText.trim() }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        setQueryText('');
        await fetchCollections();
        // 詳細ページに遷移
        window.location.href = `/collections/${newCollection.id}`;
      } else {
        const data = await response.json();
        setError(data.error || '作成に失敗しました');
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(collectionId: string) {
    if (!confirm('失敗したURLを再試行しますか？')) {
      return;
    }

    setRetryingIds(prev => new Set(prev).add(collectionId));

    try {
      const response = await fetch(`/api/collections/${collectionId}/trigger`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        await fetchCollections();
      } else {
        const data = await response.json();
        alert(data.error || '再試行の開始に失敗しました');
      }
    } catch {
      alert('ネットワークエラーが発生しました');
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(collectionId);
        return newSet;
      });
    }
  }

  function getProgressPercentage(stats: CollectionStats): number {
    if (stats.total === 0) return 0;
    return Math.round(((stats.done + stats.failed) / stats.total) * 100);
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">
          Screenshot Collection Tool
        </h1>
        <p className="text-gray-600 mb-8">
          複数のWebサイトのスクリーンショットを一括収集
        </p>

        {/* 入力フォーム */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            コレクション名（半角英数字、ハイフン、アンダースコアのみ）
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCollect()}
              placeholder="例: competitor-research"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              disabled={loading}
            />
            <button
              onClick={handleCollect}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '作成中...' : '新規作成'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Collection一覧 */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">
            過去のコレクション
          </h2>

          {collections.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              まだコレクションがありません
            </div>
          ) : (
            collections.map(collection => (
              <div
                key={collection.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <Link href={`/collections/${collection.id}`} className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 hover:text-blue-600">
                      {collection.title}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {formatDate(collection.createdAt)}
                    </span>
                    {collection.stats.failed > 0 && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleRetry(collection.id);
                        }}
                        disabled={retryingIds.has(collection.id)}
                        className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                      >
                        {retryingIds.has(collection.id) ? '処理中...' : `再試行 (${collection.stats.failed})`}
                      </button>
                    )}
                    {collection.stats.done > 0 && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(`/api/collections/${collection.id}/download`, '_blank');
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-medium"
                      >
                        Download ({collection.stats.done})
                      </button>
                    )}
                  </div>
                </div>

                <Link href={`/collections/${collection.id}`}>
                  {/* 進捗バー */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">進捗</span>
                      <span className="text-gray-600">
                        {collection.stats.done + collection.stats.failed} /{' '}
                        {collection.stats.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${getProgressPercentage(collection.stats)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 統計 */}
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">
                      ✓ {collection.stats.done} 完了
                    </span>
                    {collection.stats.failed > 0 && (
                      <span className="text-red-600">
                        ✗ {collection.stats.failed} 失敗
                      </span>
                    )}
                    {collection.stats.pending > 0 && (
                      <span className="text-gray-500">
                        ⏳ {collection.stats.pending} 待機中
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

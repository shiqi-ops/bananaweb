import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, Download, Loader2, CheckCircle2, AlertCircle,
  History, FileText, RotateCcw, Rocket,
} from 'lucide-react';
import { Button, useToast } from '@/components/shared';
import { NewModeForm } from '@/components/newmode/NewModeForm';
import {
  getNewModeJob, listNewModeJobs, downloadNewModeFile,
  type NewModeJob,
} from '@/api/endpoints';

const POLL_INTERVAL = 2500;

const STATUS_META: Record<NewModeJob['status'], { label: string; color: string; spin?: boolean }> = {
  PENDING: { label: '排队中', color: 'text-gray-500', spin: true },
  GENERATING: { label: '生成中', color: 'text-purple-600 dark:text-purple-400', spin: true },
  DIAGNOSING: { label: 'AI 诊断中', color: 'text-teal-600 dark:text-teal-400', spin: true },
  COMPLETED: { label: '已完成', color: 'text-emerald-600 dark:text-emerald-400' },
  FAILED: { label: '失败', color: 'text-red-500' },
};

function scoreColor(score?: number | null): string {
  if (score == null) return 'text-gray-400';
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500';
}

function aggregatePages(result: any): { layout: number; color: number; logic: number; text: number; renderErrors: number } {
  const agg = { layout: 0, color: 0, logic: 0, text: 0, renderErrors: 0 };
  const pages = Array.isArray(result?.pages) ? result.pages : [];
  for (const p of pages) {
    agg.layout += p.layout_issues?.length || 0;
    agg.color += p.color_issues?.length || 0;
    agg.logic += p.logic_issues?.length || 0;
    agg.text += p.text_suggestions?.length || 0;
    if (p._render_error) agg.renderErrors += 1;
  }
  return agg;
}

export const NewModePage: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [current, setCurrent] = useState<NewModeJob | null>(null);
  const [history, setHistory] = useState<NewModeJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const response = await listNewModeJobs();
      if (response.data) {
        setHistory(response.data.items || []);
      }
    } catch (error) {
      console.error('加载新模式历史失败:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const loadJob = useCallback(async (jobId: string) => {
    try {
      const response = await getNewModeJob(jobId);
      if (response.data) {
        setCurrent(response.data);
      } else {
        show({ message: response.message || '任务不存在', type: 'error' });
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '加载任务失败';
      show({ message: msg, type: 'error' });
    }
  }, [show]);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const response = await getNewModeJob(jobId);
          const job = response.data;
          if (!job) return;
          setCurrent(job);
          if (job.status === 'COMPLETED' || job.status === 'FAILED') {
            stopPolling();
            loadHistory();
          }
        } catch (error: any) {
          console.error('轮询新模式任务出错:', error);
          if (error?.response?.status === 404 || error?.response?.status >= 500) {
            stopPolling();
            show({ message: '任务查询失败，请稍后刷新页面重试', type: 'error' });
          }
        }
      }, POLL_INTERVAL);
    },
    [show, stopPolling, loadHistory]
  );

  // 卸载清理
  useEffect(() => stopPolling, [stopPolling]);

  // 初次加载：URL 带 job → 自动查看；并加载历史列表
  useEffect(() => {
    const jobParam = searchParams.get('job');
    if (jobParam) {
      loadJob(jobParam);
    }
    loadHistory();
  }, [loadJob, loadHistory, searchParams]);

  // 根据当前状态决定是否轮询
  useEffect(() => {
    if (!current) return;
    if (current.status === 'COMPLETED' || current.status === 'FAILED') {
      stopPolling();
    } else {
      startPolling(current.id);
    }
  }, [current, startPolling, stopPolling]);

  const handleCreated = (jobId: string) => {
    setSearchParams({ job: jobId });
    loadJob(jobId);
    loadHistory();
  };

  const handleSelect = (job: NewModeJob) => {
    setSearchParams({ job: job.id });
    setCurrent(job);
  };

  const handleDownload = async (job: NewModeJob) => {
    try {
      await downloadNewModeFile(job.id, job.file_name || undefined);
      show({ message: '已开始下载', type: 'success' });
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '下载失败';
      show({ message: msg, type: 'error' });
    }
  };

  const agg = current?.result ? aggregatePages(current.result) : null;
  const active = current?.status != null ? STATUS_META[current.status] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50/30 to-orange-50/30 dark:from-background-primary dark:via-background-primary dark:to-background-primary relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-pink-400/10 rounded-full blur-3xl" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* 导航栏 */}
      <nav className="relative z-50 h-16 bg-white/40 dark:bg-background-primary backdrop-blur-2xl dark:border-b dark:border-border-primary">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={18} />}
              onClick={() => navigate('/')}
              className="hover:bg-purple-100/60 dark:hover:bg-background-hover"
            >
              返回首页
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Rocket size={18} className="text-purple-600 dark:text-purple-400" />
            <span className="font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              新模式 · AI 生成
            </span>
          </div>
          <div className="w-24" />
        </div>
      </nav>

      <main className="relative max-w-5xl mx-auto px-3 md:px-4 py-6 md:py-10 space-y-6">
        {/* 顶部说明 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
            新模式：AI 生成 + AI 诊断
          </h1>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary max-w-2xl mx-auto">
            描述你的需求，AI 一键生成成品 PPT，再由原有 AI 自动诊断质量、给出评分与改进建议。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左：表单 */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-xl dark:shadow-none border-0 dark:border dark:border-border-primary rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
                <h2 className="font-semibold text-gray-900 dark:text-white">开始一个新任务</h2>
              </div>
              <NewModeForm
                defaultRequirement={current?.status === 'FAILED' ? current.requirement : ''}
                defaultTitle={current?.status === 'FAILED' ? current.title || '' : ''}
                onCreated={handleCreated}
              />
            </div>
          </div>

          {/* 右：任务状态/结果 */}
          <div className="lg:col-span-3 space-y-6">
            {current ? (
              <div className="bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-xl dark:shadow-none border-0 dark:border dark:border-border-primary rounded-2xl p-5 md:p-6">
                {/* 头部状态 */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    {active?.spin ? (
                      <Loader2 size={18} className={`animate-spin ${active.color}`} />
                    ) : current.status === 'COMPLETED' ? (
                      <CheckCircle2 size={18} className={active?.color} />
                    ) : (
                      <AlertCircle size={18} className={active?.color} />
                    )}
                    <span className={`text-sm font-semibold ${active?.color || ''}`}>{active?.label}</span>
                    {current.status === 'COMPLETED' && current.score != null && (
                      <span className={`text-2xl font-extrabold ${scoreColor(current.score)}`}>{current.score}</span>
                    )}
                  </div>
                  {current.status === 'COMPLETED' && (
                    <Button
                      size="sm"
                      icon={<Download size={16} />}
                      onClick={() => handleDownload(current)}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow hover:shadow-lg transition-all"
                    >
                      下载 PPTX
                    </Button>
                  )}
                </div>

                {/* 需求回显 */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 dark:text-foreground-tertiary mb-1">需求描述</p>
                  <p className="text-sm text-gray-700 dark:text-foreground-secondary line-clamp-3 whitespace-pre-wrap">
                    {current.requirement}
                  </p>
                </div>

                {/* 进度说明 */}
                {current.note && (
                  <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-background-elevated text-xs text-gray-600 dark:text-foreground-tertiary leading-relaxed">
                    {current.note}
                  </div>
                )}

                {/* 失败信息 */}
                {current.status === 'FAILED' && current.error_message && (
                  <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    {current.error_message}
                  </div>
                )}

                {/* 诊断摘要 */}
                {current.status === 'COMPLETED' && (
                  <div className="border-t border-gray-100 dark:border-border-primary pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-teal-600 dark:text-teal-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI 诊断报告</h3>
                    </div>
                    {current.summary && (
                      <p className="text-sm text-gray-700 dark:text-foreground-secondary leading-relaxed">
                        {current.summary}
                      </p>
                    )}
                    {agg && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-gray-50 dark:bg-background-elevated">
                          <p className="text-base font-bold text-gray-900 dark:text-white">{current.result?.total_pages ?? '—'}</p>
                          <p className="text-[10px] text-gray-400 dark:text-foreground-tertiary">总页数</p>
                        </div>
                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                          <p className="text-base font-bold text-red-500">{agg.layout}</p>
                          <p className="text-[10px] text-gray-400 dark:text-foreground-tertiary">排版问题</p>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                          <p className="text-base font-bold text-amber-500">{agg.color}</p>
                          <p className="text-[10px] text-gray-400 dark:text-foreground-tertiary">配色问题</p>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                          <p className="text-base font-bold text-blue-500">{agg.logic}</p>
                          <p className="text-[10px] text-gray-400 dark:text-foreground-tertiary">逻辑问题</p>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                          <p className="text-base font-bold text-emerald-500">{agg.text}</p>
                          <p className="text-[10px] text-gray-400 dark:text-foreground-tertiary">文字建议</p>
                        </div>
                      </div>
                    )}
                    {agg && agg.renderErrors > 0 && (
                      <p className="text-xs text-gray-400 dark:text-foreground-tertiary">
                        （注：{agg.renderErrors} 页因渲染环境未就绪跳过可视化检查，可安装 LibreOffice 后重新生成以获得完整诊断）
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-xl dark:shadow-none border-0 dark:border dark:border-border-primary rounded-2xl p-10 text-center text-gray-400 dark:text-foreground-tertiary">
                <Sparkles size={28} className="mx-auto mb-2" />
                <p className="text-sm">在左侧输入需求开始「新模式」生成</p>
              </div>
            )}

            {/* 历史记录 */}
            <div className="bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-xl dark:shadow-none border-0 dark:border dark:border-border-primary rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <History size={16} className="text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">最近生成记录</h2>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="ml-auto text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors inline-flex items-center gap-1"
                >
                  <RotateCcw size={12} /> 刷新
                </button>
              </div>

              {historyLoading && history.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-foreground-tertiary py-6 text-center">加载中...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-foreground-tertiary py-6 text-center">
                  暂无记录，生成第一个任务后会自动出现在这里
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((job) => {
                    const meta = STATUS_META[job.status];
                    return (
                      <div
                        key={job.id}
                        onClick={() => handleSelect(job)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          current?.id === job.id
                            ? 'border-purple-400 dark:border-purple-500/60 bg-purple-50/50 dark:bg-purple-950/20'
                            : 'border-gray-100 dark:border-border-primary hover:border-purple-300 dark:hover:border-border-hover hover:bg-purple-50/30 dark:hover:bg-background-hover'
                        }`}
                      >
                        {meta?.spin ? (
                          <Loader2 size={16} className={`animate-spin flex-shrink-0 ${meta.color}`} />
                        ) : job.status === 'COMPLETED' ? (
                          <CheckCircle2 size={16} className={`flex-shrink-0 ${meta?.color}`} />
                        ) : (
                          <AlertCircle size={16} className={`flex-shrink-0 ${meta?.color}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-foreground-primary truncate">
                            {job.title || job.requirement}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-foreground-tertiary">
                            {job.status === 'COMPLETED' && job.score != null
                              ? `评分 ${job.score} · `
                              : ''}
                            {job.created_at?.slice(0, 16).replace('T', ' ')}
                          </p>
                        </div>
                        <span className={`text-xs font-medium flex-shrink-0 ${meta?.color}`}>{meta?.label}</span>
                        {job.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Download size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(job);
                            }}
                            className="flex-shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <ToastContainer />
    </div>
  );
};

export default NewModePage;

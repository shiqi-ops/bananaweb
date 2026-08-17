import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, AlertCircle, CheckCircle, Loader2, Sparkles, MessageCircle, ChevronLeft } from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button, Card, useToast, Pagination } from '@/components/shared';
import { cn } from '@/utils';

// --- 类型定义 ---

interface DiagnosisPageItem {
  page_number?: number;
  page_num?: number;
  [key: string]: any;
}

interface DiagnosisResult {
  summary: string;
  score: number;
  pages: DiagnosisPageItem[];
}

interface DiagnosisTaskResponse {
  task_id: string;
  status: string;
  result?: DiagnosisResult;
  error?: string;
}

// --- 常量 ---

const DIAGNOSIS_OPTIONS = ['layout', 'color', 'logic', 'text'];
const POLLING_INTERVAL = 3000;

// --- 页面状态 ---

type PagePhase = 'upload' | 'uploading' | 'analyzing' | 'completed' | 'failed';

export const DiagnosisPage: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();

  // 上传状态
  const [phase, setPhase] = useState<PagePhase>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 诊断任务状态
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 轮询 ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // 验证文件类型
  const isValidFile = (file: File): boolean => {
    const name = file.name.toLowerCase();
    return name.endsWith('.pptx') || name.endsWith('.pdf');
  };

  // 处理文件选择（拖拽或点击）
  const handleFileSelect = (file: File) => {
    if (!isValidFile(file)) {
      show({ message: '仅支持 PPTX 和 PDF 文件', type: 'error' });
      return;
    }
    setSelectedFile(file);
  };

  // 上传文件并触发诊断
  const handleUpload = async () => {
    if (!selectedFile) return;

    setPhase('uploading');
    stopPolling();

    try {
      // 第一步：上传文件获取文件路径
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);

      const uploadResponse = await apiClient.post<{ data?: { file_path: string; file_type: string } }>(
        '/api/diagnosis/upload',
        uploadFormData
      );

      const filePath = uploadResponse.data?.data?.file_path;
      const fileType = uploadResponse.data?.data?.file_type || (selectedFile.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'pptx');

      if (!filePath) {
        throw new Error('获取文件路径失败');
      }

      setPhase('analyzing');

      // 第二步：创建诊断任务
      const diagnosisResponse = await apiClient.post<{ data?: DiagnosisTaskResponse }>(
        '/api/diagnosis',
        {
          file_path: filePath,
          file_type: fileType,
          diagnosis_options: DIAGNOSIS_OPTIONS,
        }
      );

      const taskIdValue = diagnosisResponse.data?.data?.task_id;
      if (!taskIdValue) {
        throw new Error('创建诊断任务失败');
      }

      setTaskId(taskIdValue);

      // 第三步：开始轮询结果
      startPolling(taskIdValue);
    } catch (error: any) {
      console.error('上传或诊断失败:', error);
      const msg = error?.response?.data?.error?.message || error?.message || '诊断失败';
      setErrorMessage(msg);
      setPhase('failed');
      show({ message: msg, type: 'error' });
    }
  };

  // 轮询诊断结果
  const startPolling = (taskIdValue: string) => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
        const response = await apiClient.get<{ data?: DiagnosisTaskResponse }>(
          `/api/diagnosis/${taskIdValue}`
        );

        const taskData = response.data?.data;
        if (!taskData) return;

        if (taskData.status === 'COMPLETED') {
          stopPolling();
          setResult(taskData.result || null);
          setPhase('completed');
          setCurrentPage(1);
          show({ message: '诊断完成', type: 'success' });
        } else if (taskData.status === 'FAILED') {
          stopPolling();
          const errMsg = taskData.error || '诊断失败';
          setErrorMessage(errMsg);
          setPhase('failed');
          show({ message: errMsg, type: 'error' });
        }
        // PENDING / RUNNING: 继续轮询
      } catch (error: any) {
        console.error('轮询出错:', error);
        // 遇到 404 或 5xx 错误则停止轮询
        if (error?.response?.status === 404 || error?.response?.status >= 500) {
          stopPolling();
          const msg = error?.response?.data?.error?.message || error?.message || '诊断失败';
          setErrorMessage(msg);
          setPhase('failed');
          show({ message: msg, type: 'error' });
        }
      }
    }, POLLING_INTERVAL);
  };

  // 一键应用优化
  const handleApplyOptimization = async () => {
    if (!taskId) return;
    setIsApplying(true);
    try {
      const response = await apiClient.post<{ data?: { project_id: string; task_id: string } }>(
        `/api/diagnosis/${taskId}/apply`,
        {}
      );
      const projectId = response.data?.data?.project_id;
      if (!projectId) {
        throw new Error('创建优化项目失败，未返回项目ID');
      }
      show({ message: '优化已应用成功', type: 'success' });
      navigate(`/project/${projectId}/detail`);
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error?.message || '应用优化失败';
      show({ message: msg, type: 'error' });
    } finally {
      setIsApplying(false);
    }
  };

  // 付费一对一指导
  const handlePaidGuidance = () => {
    show({ message: '即将跳转至定制服务页面', type: 'info' });
  };

  // 重置状态
  const handleReset = () => {
    stopPolling();
    setPhase('upload');
    setSelectedFile(null);
    setTaskId(null);
    setResult(null);
    setErrorMessage('');
    setCurrentPage(1);
  };

  // 当前页的问题数据
  const currentPageData = result?.pages?.[currentPage - 1] || null;
  const totalPages = result?.pages?.length || 0;

  // 渲染上传区域
  const renderUploadArea = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 dark:border-border-primary rounded-xl p-10 text-center cursor-pointer hover:border-banana-400 dark:hover:border-banana transition-colors duration-200"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files[0];
          if (file) handleFileSelect(file);
        }}
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText size={28} className="text-banana-600 dark:text-banana" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-foreground-tertiary">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload size={40} className="mx-auto text-gray-400 dark:text-foreground-tertiary" />
            <p className="text-sm text-gray-600 dark:text-foreground-secondary">点击或拖拽上传 PPT 或 PDF 文件</p>
            <p className="text-xs text-gray-400 dark:text-foreground-tertiary">支持 .pptx, .pdf 格式</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />

      <div className="flex justify-center">
        <Button
          size="lg"
          icon={<Upload size={18} />}
          disabled={!selectedFile}
          onClick={handleUpload}
          className="px-8"
        >
          开始诊断
        </Button>
      </div>
    </div>
  );

  // 渲染上传中
  const renderUploading = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <Loader2 size={48} className="text-banana-600 dark:text-banana animate-spin" />
      </div>
      <p className="text-base font-medium text-gray-700 dark:text-foreground-secondary">
        正在上传文件...
      </p>
    </div>
  );

  // 渲染分析中
  const renderAnalyzing = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <Loader2 size={48} className="text-banana-600 dark:text-banana animate-spin" />
        <Sparkles
          size={20}
          className="absolute -top-1 -right-1 text-orange-500 animate-pulse"
        />
      </div>
      <p className="text-base font-medium text-gray-700 dark:text-foreground-secondary">
        正在诊断分析中...
      </p>
      <p className="text-sm text-gray-500 dark:text-foreground-tertiary max-w-md text-center">
        AI 正在从排版、配色、逻辑、文本等方面分析您的 PPT，请稍候...
      </p>
    </div>
  );

  // 渲染结果
  const renderResult = () => {
    if (!result) return null;

    const { summary, score, pages } = result;

    // 评分颜色
    const scoreColor = score >= 80
      ? 'text-green-600 dark:text-green-400'
      : score >= 60
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

    const scoreRingColor = score >= 80
      ? 'stroke-green-500'
      : score >= 60
        ? 'stroke-yellow-500'
        : 'stroke-red-500';

    // 计算圈圈百分比
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="space-y-6">
        {/* 评分和总结 */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* 评分圆圈 */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40" cy="40" r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="40" cy="40" r="36"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className={scoreRingColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-2xl font-bold', scoreColor)}>
                  {score}
                </span>
              </div>
            </div>
            <span className="mt-1 text-xs text-gray-500 dark:text-foreground-tertiary">
              综合评分
            </span>
          </div>

          {/* 总结 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              总结
            </h3>
            <p className="text-sm text-gray-600 dark:text-foreground-secondary leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          </div>
        </div>

        {/* 分页问题列表 */}
        {pages.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              问题详情
            </h3>

            {currentPageData && (() => {
              const pageNum = currentPageData.page_number ?? currentPageData.page_num ?? currentPage;
              const categories: { label: string; key: string; color: string }[] = [
                { label: '排版布局', key: 'layout_issues', color: 'border-red-400' },
                { label: '配色方案', key: 'color_issues', color: 'border-orange-400' },
                { label: '内容逻辑', key: 'logic_issues', color: 'border-blue-400' },
                { label: '文字表达', key: 'text_suggestions', color: 'border-green-400' },
              ];
              const allIssues = categories.flatMap(c =>
                (currentPageData[c.key] || []).map((item: any) => ({ ...item, _category: c.label, _color: c.color }))
              );

              return (
                <Card className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    {taskId && (
                      <div className="flex-shrink-0 w-full md:w-48 h-36 bg-gray-100 dark:bg-background-hover rounded-lg overflow-hidden">
                        <img
                          src={`/api/diagnosis/${taskId}/preview/${pageNum}`}
                          alt={`第 ${pageNum} 页`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '';
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        第 {pageNum} 页问题
                      </h4>
                      {allIssues.length > 0 ? (
                        <ul className="space-y-2">
                          {allIssues.map((item, idx) => (
                            <li
                              key={idx}
                              className={`flex items-start gap-2 text-sm text-gray-600 dark:text-foreground-secondary border-l-2 ${item._color} pl-2`}
                            >
                              <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-orange-500" />
                              <div>
                                <span className="text-xs text-gray-400 mr-1">[{item._category}]</span>
                                <span>{item.description || item.suggested || item.suggestion || JSON.stringify(item)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <CheckCircle size={14} />
                          <span>暂无问题</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* 分页导航 */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-border-primary">
          <Button
            size="md"
            icon={<Sparkles size={16} />}
            onClick={handleApplyOptimization}
            loading={isApplying}
            className="flex-1"
          >
            一键应用优化
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<MessageCircle size={16} />}
            onClick={handlePaidGuidance}
            className="flex-1"
          >
            付费一对一指导
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={handleReset}
            className="flex-1"
          >
            重新上传
          </Button>
        </div>
      </div>
    );
  };

  // 渲染失败
  const renderFailed = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <p className="text-base font-medium text-gray-700 dark:text-foreground-secondary">
        诊断失败
      </p>
      {errorMessage && (
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary max-w-md text-center">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-3 mt-2">
        {taskId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startPolling(taskId)}
          >
            重新诊断
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleReset}
        >
          重新上传
        </Button>
      </div>
    </div>
  );

  // 页面主体渲染
  const renderContent = () => {
    switch (phase) {
      case 'upload':
        return renderUploadArea();
      case 'uploading':
        return renderUploading();
      case 'analyzing':
        return renderAnalyzing();
      case 'completed':
        return renderResult();
      case 'failed':
        return renderFailed();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
      {/* 页面头 */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-500 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            PPT 诊断
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary ml-9">
          上传您的 PPT/PDF 文件，AI 将从排版、配色、逻辑、文本等方面进行全面诊断
        </p>
      </div>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        <Card className="p-6 md:p-10 bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-2xl dark:shadow-none border-0 dark:border dark:border-border-primary">
          {renderContent()}
        </Card>
      </main>

      <ToastContainer />
    </div>
  );
};

export default DiagnosisPage;
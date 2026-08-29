import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  FileText,
  DollarSign,
  Calendar,
  CreditCard,
  ExternalLink,
  Sparkles,
  User,
  Clock,
} from 'lucide-react';
import { apiClient, getImageUrl } from '@/api/client';
import { Button, Card, useToast } from '@/components/shared';
import { cn } from '@/utils';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PENDING: { label: '待处理', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  PAID: { label: '已支付', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  IN_PROGRESS: { label: '制作中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  COMPLETED: { label: '已完成', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
};

const PAYMENT_MAP: Record<string, { label: string; className: string }> = {
  UNPAID: { label: '未支付', className: 'text-red-500' },
  PAID: { label: '已支付', className: 'text-green-600 dark:text-green-400' },
  REFUNDED: { label: '已退款', className: 'text-gray-500' },
};

interface OrderPage {
  page_id: string;
  order_index: number;
  part?: string | null;
  generated_image_url?: string | null;
  status: string;
  updated_at?: string | null;
}

interface OrderProject {
  project_id: string;
  status: string;
  image_aspect_ratio?: string;
  pages?: OrderPage[];
}

interface OrderDetail {
  id: string;
  contact_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  requirement: string;
  page_count?: number | null;
  usage_scenario?: string | null;
  price?: number | null;
  status: string;
  payment_status: string;
  deadline?: string | null;
  created_at?: string | null;
  project_id?: string | null;
  project?: OrderProject | null;
}

const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 尚未生成完成的页面状态
const PAGE_PENDING_STATUSES = ['DRAFT', 'GENERATING_DESCRIPTION', 'DESCRIPTION_GENERATED', 'QUEUED', 'GENERATING'];

export const OrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { show, ToastContainer } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await apiClient.get<{ data?: OrderDetail }>(`/api/orders/${orderId}`);
      setOrder(response.data?.data || null);
    } catch (error: any) {
      // 404 或 5xx 错误时停止轮询
      if (error?.response?.status === 404 || error?.response?.status >= 500) {
        stopPolling();
      }
      const msg = error?.response?.data?.message || error?.message || '获取订单详情失败';
      show({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [orderId, stopPolling, show]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(fetchOrder, 3000);
  }, [stopPolling, fetchOrder]);

  // 首次加载
  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // 根据订单/项目状态决定是否继续轮询（生成中则持续刷新）
  useEffect(() => {
    if (!order) return;

    // 未支付：不轮询
    if (order.payment_status !== 'PAID') {
      stopPolling();
      return;
    }

    const project = order.project;
    // 已支付但项目还没就绪（后台仍在创建项目）
    if (!project) {
      startPolling();
      return;
    }

    const pages = project.pages || [];
    const done =
      project.status === 'COMPLETED' ||
      (pages.length > 0 && pages.every((p) => !PAGE_PENDING_STATUSES.includes(p.status)));

    if (done) {
      stopPolling();
    } else {
      startPolling();
    }
  }, [order, startPolling, stopPolling]);

  const handlePay = async () => {
    if (!order) return;
    setPaying(true);
    try {
      await apiClient.post(`/api/orders/${order.id}/pay`);
      show({ message: '支付成功，正在为你生成 PPT...', type: 'success' });
      setOrder((prev) => (prev ? { ...prev, payment_status: 'PAID', status: 'PAID' } : prev));
      // 支付成功后立即拉一次，等待后台生成
      fetchOrder();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '支付失败';
      show({ message: msg, type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
        <Loader2 size={28} className="text-banana-600 dark:text-banana animate-spin" />
        <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">加载订单详情...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
        <p className="text-gray-500 dark:text-foreground-tertiary mb-4">没有找到该订单</p>
        <Button variant="secondary" onClick={() => navigate('/orders')}>返回订单列表</Button>
      </div>
    );
  }

  const project = order.project;
  const pages = project?.pages || [];
  const generatedCount = pages.filter((p) => p.generated_image_url).length;
  const isProjectReady = project != null;
  const isGenerating = order.payment_status === 'PAID' && (!isProjectReady || project!.status !== 'COMPLETED');
  const aspectRatioStyle = (() => {
    const parts = (project?.image_aspect_ratio || '16:9').split(':');
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (w > 0 && h > 0) return `${w}/${h}`;
    }
    return '16/9';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
      {/* 页面头 */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate('/orders')}
            className="p-1.5 rounded-lg text-gray-500 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">订单详情</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary ml-9">订单号：{order.id}</p>
      </div>

      <main className="max-w-4xl mx-auto px-4 pb-16 space-y-6">
        {/* 订单信息 */}
        <Card className="p-5 md:p-6">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', (STATUS_MAP[order.status] || STATUS_MAP.PENDING).className)}>
              {(STATUS_MAP[order.status] || STATUS_MAP.PENDING).label}
            </span>
            <span className={cn('text-xs font-medium', (PAYMENT_MAP[order.payment_status] || { className: '' }).className)}>
              {(PAYMENT_MAP[order.payment_status] || { label: order.payment_status }).label}
            </span>
          </div>

          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">需求描述</h2>
          <p className="text-sm text-gray-600 dark:text-foreground-secondary whitespace-pre-line mb-4">{order.requirement}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-foreground-secondary">
            <span className="flex items-center gap-2">
              <User size={16} className="text-gray-400 dark:text-foreground-tertiary" />
              {order.contact_name}
              {order.contact_phone ? `（${order.contact_phone}）` : ''}
            </span>
            <span className="flex items-center gap-2">
              <FileText size={16} className="text-gray-400 dark:text-foreground-tertiary" />
              {order.page_count != null ? `${order.page_count} 页` : '页数待定'}
            </span>
            <span className="flex items-center gap-2">
              <DollarSign size={16} className="text-gray-400 dark:text-foreground-tertiary" />
              {order.price != null ? `¥${order.price}` : '—'}
            </span>
            <span className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400 dark:text-foreground-tertiary" />
              {formatDate(order.created_at)}
            </span>
            {order.deadline && (
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400 dark:text-foreground-tertiary" />
                期望交付：{formatDate(order.deadline)}
              </span>
            )}
          </div>

          {order.payment_status === 'UNPAID' && (
            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-border-primary">
              <Button icon={<CreditCard size={16} />} loading={paying} onClick={handlePay}>
                去支付（¥{order.price ?? '—'}）
              </Button>
            </div>
          )}
        </Card>

        {/* PPT 区域 */}
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">对应 PPT</h2>
            {isProjectReady && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ExternalLink size={16} />}
                  onClick={() => navigate(`/project/${project!.project_id}/preview`)}
                >
                  预览
                </Button>
                <Button
                  size="sm"
                  icon={<Sparkles size={16} />}
                  onClick={() => navigate(`/project/${project!.project_id}/detail`)}
                >
                  在编辑器中打开
                </Button>
              </div>
            )}
          </div>

          {order.payment_status !== 'PAID' ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">支付后才能查看对应的 PPT</p>
            </div>
          ) : !isProjectReady ? (
            <div className="py-12 flex flex-col items-center">
              <Loader2 size={28} className="text-banana-600 dark:text-banana animate-spin mb-3" />
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">正在生成 PPT，请稍候...</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="py-12 flex flex-col items-center">
              <Loader2 size={28} className="text-banana-600 dark:text-banana animate-spin mb-3" />
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">正在解析需求并生成页面...</p>
            </div>
          ) : (
            <>
              {isGenerating && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                  <Loader2 size={16} className="text-banana-600 dark:text-banana animate-spin" />
                  正在生成图片（{generatedCount}/{pages.length}）...
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pages.map((page, index) => (
                  <div key={page.page_id} className="relative">
                    <div
                      className="rounded-lg overflow-hidden bg-gray-100 dark:bg-background-hover border border-gray-200 dark:border-border-primary"
                      style={{ aspectRatio: aspectRatioStyle }}
                    >
                      {page.generated_image_url ? (
                        <img
                          src={getImageUrl(page.generated_image_url, page.updated_at ?? undefined)}
                          alt={`第 ${index + 1} 页`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-foreground-tertiary">
                          {PAGE_PENDING_STATUSES.includes(page.status) ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            index + 1
                          )}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 block text-center text-xs text-gray-400 dark:text-foreground-tertiary">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </main>

      <ToastContainer />
    </div>
  );
};

export default OrderDetailPage;

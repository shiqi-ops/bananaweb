import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Inbox, Calendar, DollarSign, FileText, ClipboardList, CreditCard } from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button, Card, useToast } from '@/components/shared';
import { cn } from '@/utils';

// 与 CustomOrderPage / SharePage 保持一致的用户标识（当前无用户体系，先写死）
const USER_ID = 'user-001';

interface OrderItem {
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
  updated_at?: string | null;
}

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

export const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data?: OrderItem[] }>(`/api/orders?user_id=${USER_ID}`);
      setOrders(response.data?.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '获取订单列表失败';
      show({ message: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async (id: string) => {
    setPayingId(id);
    try {
      await apiClient.post(`/api/orders/${id}/pay`);
      show({ message: '支付成功', type: 'success' });
      // 支付接口会同步把订单标记为已支付，直接更新本地状态即可
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, payment_status: 'PAID', status: 'PAID' } : o
        )
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || '支付失败';
      show({ message: msg, type: 'error' });
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
      {/* 页面头 */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-gray-500 dark:text-foreground-tertiary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              我的订单
            </h1>
          </div>
          <Button size="sm" icon={<ClipboardList size={16} />} onClick={() => navigate('/custom')}>
            去下单
          </Button>
        </div>
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary ml-9">
          查看你提交的私人定制订单记录
        </p>
      </div>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-banana-600 dark:text-banana animate-spin" />
            <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
              加载订单列表...
            </span>
          </div>
        ) : orders.length === 0 ? (
          <Card className="p-10 text-center">
            <Inbox size={48} className="mx-auto text-gray-300 dark:text-foreground-tertiary mb-3" />
            <p className="text-gray-500 dark:text-foreground-tertiary">还没有订单记录</p>
            <Button className="mt-4" onClick={() => navigate('/custom')}>
              立即定制
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <Card key={o.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          (STATUS_MAP[o.status] || STATUS_MAP.PENDING).className
                        )}
                      >
                        {(STATUS_MAP[o.status] || STATUS_MAP.PENDING).label}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          (PAYMENT_MAP[o.payment_status] || { className: '' }).className
                        )}
                      >
                        {(PAYMENT_MAP[o.payment_status] || { label: o.payment_status }).label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-foreground-tertiary truncate">
                        订单号：{o.id}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{o.requirement}</p>
                    <div className="flex items-center gap-4 flex-wrap mt-3 text-xs text-gray-500 dark:text-foreground-tertiary">
                      <span className="flex items-center gap-1">
                        <FileText size={14} /> {o.page_count ?? '—'} 页
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign size={14} /> {o.price != null ? `¥${o.price}` : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> {formatDate(o.created_at)}
                      </span>
                    </div>
                    {o.deadline && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-foreground-tertiary">
                        期望交付：{formatDate(o.deadline)}
                      </p>
                    )}
                  </div>
                  {o.payment_status === 'UNPAID' && (
                    <Button
                      size="sm"
                      icon={<CreditCard size={16} />}
                      loading={payingId === o.id}
                      onClick={() => handlePay(o.id)}
                      className="flex-shrink-0"
                    >
                      去支付
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <ToastContainer />
    </div>
  );
};

export default OrderHistoryPage;

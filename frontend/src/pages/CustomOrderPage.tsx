import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  User,
  Phone,
  Mail,
  FileText,
  Palette,
  GraduationCap,
  Calendar,
  DollarSign,
  Upload,
  X,
  Loader2,
  CheckCircle,
  Send,
  CreditCard,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button, Card, Modal, useToast } from '@/components/shared';
import { cn } from '@/utils';

// --- 类型定义 ---

interface Style {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
}

interface Mentor {
  id: string;
  name: string;
  title?: string;
  avatar_url?: string;
}

interface PriceResponse {
  total_price: number;
}

interface OrderResponse {
  order_id: string;
}

interface PaymentStatusResponse {
  status: string;
}

// --- 常量 ---

const POLLING_INTERVAL = 3000;

// --- 组件 ---

export const CustomOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();

  // 联系人表单状态
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [pageCount, setPageCount] = useState<number>(10);
  const [useScenario, setUseScenario] = useState('');

  // 风格选择状态
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [stylesLoading, setStylesLoading] = useState(false);

  // 导师选择状态
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<string>('');
  const [mentorsLoading, setMentorsLoading] = useState(false);

  // 交付时间
  const [deliveryTime, setDeliveryTime] = useState('');

  // 价格计算状态
  const [price, setPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // 参考素材上传状态
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 提交订单状态
  const [submitting, setSubmitting] = useState(false);

  // 支付状态
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPolling, setPaymentPolling] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // 获取风格列表
  useEffect(() => {
    const fetchStyles = async () => {
      setStylesLoading(true);
      try {
        const response = await apiClient.get<{ data?: Style[] }>('/api/styles');
        setStyles(response.data?.data || []);
      } catch (error: any) {
        const msg = error?.response?.data?.error?.message || error?.message || '获取风格列表失败';
        show({ message: msg, type: 'error' });
      } finally {
        setStylesLoading(false);
      }
    };
    fetchStyles();
  }, [show]);

  // 获取导师列表
  useEffect(() => {
    const fetchMentors = async () => {
      setMentorsLoading(true);
      try {
        const response = await apiClient.get<{ data?: Mentor[] }>('/api/mentors');
        setMentors(response.data?.data || []);
      } catch (error: any) {
        const msg = error?.response?.data?.error?.message || error?.message || '获取导师列表失败';
        show({ message: msg, type: 'error' });
      } finally {
        setMentorsLoading(false);
      }
    };
    fetchMentors();
  }, [show]);

  // 价格计算（当 page_count、selectedStyle、selectedMentor 变化时自动触发）
  useEffect(() => {
    if (!pageCount || !selectedStyle || !selectedMentor) {
      setPrice(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPriceLoading(true);
      try {
        const response = await apiClient.post<{ data?: PriceResponse }>('/api/orders/prices', {
          page_count: pageCount,
          style_id: selectedStyle,
          mentor_id: selectedMentor,
        });
        const totalPrice = response.data?.data?.total_price;
        setPrice(totalPrice != null ? Math.round(totalPrice * 100) / 100 : null);
      } catch (error: any) {
        console.error('价格计算失败:', error);
        setPrice(null);
      } finally {
        setPriceLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [pageCount, selectedStyle, selectedMentor]);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setReferenceFiles((prev) => [...prev, ...Array.from(files)]);
    }
    e.target.value = '';
  };

  // 移除文件
  const removeFile = (index: number) => {
    setReferenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 提交订单
  const handleSubmit = async () => {
    // 表单验证
    if (!name.trim()) {
      show({ message: '请输入联系人姓名', type: 'error' });
      return;
    }
    if (!description.trim()) {
      show({ message: '请输入需求描述', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', 'user-001');
      formData.append('name', name.trim());
      if (phone.trim()) formData.append('phone', phone.trim());
      if (email.trim()) formData.append('email', email.trim());
      formData.append('description', description.trim());
      formData.append('page_count', String(pageCount));
      if (useScenario.trim()) formData.append('use_scenario', useScenario.trim());
      if (selectedStyle) formData.append('style_id', selectedStyle);
      if (selectedMentor) formData.append('mentor_id', selectedMentor);
      if (deliveryTime) formData.append('delivery_time', deliveryTime);

      // 添加参考素材文件
      referenceFiles.forEach((file) => {
        formData.append('reference_files', file);
      });

      const response = await apiClient.post<{ data?: OrderResponse }>('/api/orders', formData);
      const orderIdValue = response.data?.data?.order_id;
      if (orderIdValue) {
        setOrderId(orderIdValue);
        setShowPaymentModal(true);
        show({ message: '订单创建成功', type: 'success' });
      } else {
        throw new Error('获取订单 ID 失败');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error?.message || '提交订单失败';
      show({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // 处理支付
  const handlePay = async () => {
    if (!orderId) return;
    setPaymentLoading(true);
    try {
      await apiClient.post(`/api/orders/${orderId}/pay`);
      setPaymentLoading(false);
      setPaymentPolling(true);
      show({ message: '支付请求已提交，正在查询支付状态...', type: 'info' });
      startPaymentPolling(orderId);
    } catch (error: any) {
      setPaymentLoading(false);
      const msg = error?.response?.data?.error?.message || error?.message || '支付失败';
      show({ message: msg, type: 'error' });
    }
  };

  // 轮询支付状态
  const startPaymentPolling = (orderIdValue: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const response = await apiClient.get<{ data?: PaymentStatusResponse }>(
          `/api/orders/${orderIdValue}/payment-status`
        );
        const status = response.data?.data?.status;
        if (status === 'completed' || status === 'paid') {
          stopPolling();
          setPaymentPolling(false);
          setPaymentCompleted(true);
          show({ message: '支付完成', type: 'success' });
        } else if (status === 'failed') {
          stopPolling();
          setPaymentPolling(false);
          show({ message: '支付失败，请重试', type: 'error' });
        }
        // 'pending' 或其他状态则继续轮询
      } catch (error: any) {
        console.error('支付轮询出错:', error);
        if (error?.response?.status === 404 || error?.response?.status >= 500) {
          stopPolling();
          setPaymentPolling(false);
          const msg = error?.response?.data?.error?.message || error?.message || '支付状态查询失败';
          show({ message: msg, type: 'error' });
        }
      }
    }, POLLING_INTERVAL);
  };

  // 关闭支付弹窗
  const handleClosePaymentModal = () => {
    if (!paymentPolling && !paymentLoading) {
      setShowPaymentModal(false);
    }
  };

  // --- 渲染 ---

  // 渲染表单输入框
  const renderInput = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    options?: {
      placeholder?: string;
      required?: boolean;
      icon?: React.ReactNode;
      type?: string;
    }
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
        {label}
        {options?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {options?.icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-foreground-tertiary">
            {options.icon}
          </div>
        )}
        <input
          type={options?.type || 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={options?.placeholder}
          className={cn(
            'w-full rounded-lg border border-gray-200 dark:border-border-primary',
            'bg-white dark:bg-background-primary',
            'text-gray-900 dark:text-white',
            'placeholder-gray-400 dark:placeholder-foreground-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent',
            'transition-all duration-200',
            'text-sm',
            options?.icon ? 'pl-10 pr-3 py-2.5' : 'px-3 py-2.5'
          )}
        />
      </div>
    </div>
  );

  // 渲染文本域
  const renderTextarea = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    options?: {
      placeholder?: string;
      required?: boolean;
      rows?: number;
    }
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
        {label}
        {options?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={options?.placeholder}
        rows={options?.rows || 3}
        className={cn(
          'w-full rounded-lg border border-gray-200 dark:border-border-primary',
          'bg-white dark:bg-background-primary',
          'text-gray-900 dark:text-white',
          'placeholder-gray-400 dark:placeholder-foreground-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent',
          'transition-all duration-200',
          'text-sm px-3 py-2.5 resize-y'
        )}
      />
    </div>
  );

  // 渲染风格选择
  const renderStyleSelection = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-banana-600 dark:text-banana" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          选择风格
        </h3>
      </div>
      {stylesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="text-banana-600 dark:text-banana animate-spin" />
          <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
            加载风格列表...
          </span>
        </div>
      ) : styles.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-foreground-tertiary py-4 text-center">
          暂无可用风格
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {styles.map((style) => (
            <Card
              key={style.id}
              hoverable
              className={cn(
                'p-4 cursor-pointer transition-all duration-200',
                selectedStyle === style.id
                  ? 'ring-2 ring-banana-500 border-banana-500 bg-banana-50 dark:bg-banana-900/20'
                  : ''
              )}
              onClick={() => setSelectedStyle(style.id)}
            >
              {style.preview_url && (
                <div className="w-full h-20 rounded-lg overflow-hidden mb-2 bg-gray-100 dark:bg-background-hover">
                  <img
                    src={style.preview_url}
                    alt={style.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {style.name}
              </p>
              {style.description && (
                <p className="text-xs text-gray-500 dark:text-foreground-tertiary text-center mt-1 line-clamp-2">
                  {style.description}
                </p>
              )}
              {selectedStyle === style.id && (
                <CheckCircle
                  size={16}
                  className="text-banana-600 dark:text-banana mx-auto mt-1"
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // 渲染导师选择
  const renderMentorSelection = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} className="text-banana-600 dark:text-banana" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          选择导师
        </h3>
      </div>
      {mentorsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="text-banana-600 dark:text-banana animate-spin" />
          <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
            加载导师列表...
          </span>
        </div>
      ) : mentors.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-foreground-tertiary py-4 text-center">
          暂无可用导师
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {mentors.map((mentor) => (
            <Card
              key={mentor.id}
              hoverable
              className={cn(
                'p-4 cursor-pointer transition-all duration-200',
                selectedMentor === mentor.id
                  ? 'ring-2 ring-banana-500 border-banana-500 bg-banana-50 dark:bg-banana-900/20'
                  : ''
              )}
              onClick={() => setSelectedMentor(mentor.id)}
            >
              {mentor.avatar_url && (
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-2 bg-gray-100 dark:bg-background-hover">
                  <img
                    src={mentor.avatar_url}
                    alt={mentor.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <p className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {mentor.name}
              </p>
              {mentor.title && (
                <p className="text-xs text-gray-500 dark:text-foreground-tertiary text-center mt-1 line-clamp-2">
                  {mentor.title}
                </p>
              )}
              {selectedMentor === mentor.id && (
                <CheckCircle
                  size={16}
                  className="text-banana-600 dark:text-banana mx-auto mt-1"
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // 渲染价格计算
  const renderPriceSection = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign size={18} className="text-banana-600 dark:text-banana" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          价格预估
        </h3>
      </div>
      <div className="bg-gray-50 dark:bg-background-hover rounded-lg p-4">
        {!selectedStyle || !selectedMentor ? (
          <p className="text-sm text-gray-400 dark:text-foreground-tertiary text-center">
            请选择风格和导师以计算价格
          </p>
        ) : priceLoading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="text-banana-600 dark:text-banana animate-spin" />
            <span className="text-sm text-gray-500 dark:text-foreground-tertiary">
              计算中...
            </span>
          </div>
        ) : price !== null ? (
          <div className="text-center">
            <span className="text-sm text-gray-500 dark:text-foreground-tertiary">预估总价：</span>
            <span className="text-2xl font-bold text-banana-600 dark:text-banana">
              ¥{price.toFixed(2)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-foreground-tertiary text-center">
            无法计算价格，请检查参数
          </p>
        )}
      </div>
    </div>
  );

  // 渲染文件上传
  const renderFileUpload = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Upload size={18} className="text-banana-600 dark:text-banana" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          参考素材上传
        </h3>
      </div>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer',
          'border-gray-300 dark:border-border-primary',
          'hover:border-banana-400 dark:hover:border-banana',
          'transition-colors duration-200'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={32} className="mx-auto text-gray-400 dark:text-foreground-tertiary mb-2" />
        <p className="text-sm text-gray-600 dark:text-foreground-secondary">
          点击上传参考素材
        </p>
        <p className="text-xs text-gray-400 dark:text-foreground-tertiary mt-1">
          支持多文件上传
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {referenceFiles.length > 0 && (
        <div className="space-y-2">
          {referenceFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 bg-gray-50 dark:bg-background-hover rounded-lg px-3 py-2"
            >
              <FileText size={16} className="text-gray-400 dark:text-foreground-tertiary flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-700 dark:text-foreground-secondary truncate">
                {file.name}
              </span>
              <span className="text-xs text-gray-400 dark:text-foreground-tertiary flex-shrink-0">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 渲染支付弹窗
  const renderPaymentModal = () => (
    <Modal
      isOpen={showPaymentModal}
      onClose={handleClosePaymentModal}
      title="订单创建成功"
      size="sm"
    >
      <div className="space-y-6">
        {paymentCompleted ? (
          <div className="flex flex-col items-center py-4 space-y-3">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">支付完成</p>
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary text-center">
              您的订单已支付成功，我们将尽快为您服务
            </p>
            <Button
              size="md"
              onClick={() => {
                setShowPaymentModal(false);
                navigate('/');
              }}
              className="mt-2"
            >
              返回首页
            </Button>
          </div>
        ) : paymentPolling ? (
          <div className="flex flex-col items-center py-4 space-y-3">
            <Loader2 size={32} className="text-banana-600 dark:text-banana animate-spin" />
            <p className="text-base font-medium text-gray-700 dark:text-foreground-secondary">
              支付处理中...
            </p>
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary text-center">
              正在查询支付状态，请稍候
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 space-y-3">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <p className="text-base font-medium text-gray-700 dark:text-foreground-secondary">
              订单已创建
            </p>
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary text-center">
              订单编号：{orderId}
            </p>
            <div className="flex gap-3 mt-2 w-full">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowPaymentModal(false)}
              >
                稍后支付
              </Button>
              <Button
                size="md"
                icon={<CreditCard size={16} />}
                loading={paymentLoading}
                className="flex-1"
                onClick={handlePay}
              >
                去支付
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );

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
            私人定制下单
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary ml-9">
          填写需求信息，AI 将为您量身定制专属 PPT
        </p>
      </div>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        <Card className="p-6 md:p-10 bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-2xl dark:shadow-none border-0 dark:border dark:border-border-primary">
          <div className="space-y-8">
            {/* 联系人表单 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
                <User size={18} className="text-banana-600 dark:text-banana" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  联系人信息
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInput('姓名', name, setName, {
                  placeholder: '请输入您的姓名',
                  required: true,
                  icon: <User size={16} />,
                })}
                {renderInput('电话', phone, setPhone, {
                  placeholder: '请输入您的电话',
                  icon: <Phone size={16} />,
                  type: 'tel',
                })}
                {renderInput('邮箱', email, setEmail, {
                  placeholder: '请输入您的邮箱',
                  icon: <Mail size={16} />,
                  type: 'email',
                })}
                {renderInput('期望页数', String(pageCount), (val) => {
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 0) setPageCount(num);
                  else if (val === '') setPageCount(0);
                }, {
                  placeholder: '请输入期望页数',
                  type: 'number',
                })}
              </div>
              {renderTextarea('需求描述', description, setDescription, {
                placeholder: '请详细描述您的需求，例如：PPT 的主题、用途、风格偏好等',
                required: true,
                rows: 4,
              })}
              {renderTextarea('使用场景', useScenario, setUseScenario, {
                placeholder: '例如：毕业答辩、产品发布会、商业计划书等',
                rows: 2,
              })}
            </section>

            {/* 风格选择 */}
            <section className="space-y-4">
              <div className="border-b border-gray-100 dark:border-border-primary pb-2" />
              {renderStyleSelection()}
            </section>

            {/* 导师选择 */}
            <section className="space-y-4">
              <div className="border-b border-gray-100 dark:border-border-primary pb-2" />
              {renderMentorSelection()}
            </section>

            {/* 交付时间和价格 */}
            <section className="space-y-4">
              <div className="border-b border-gray-100 dark:border-border-primary pb-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 交付时间 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-banana-600 dark:text-banana" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      期望交付时间
                    </h3>
                  </div>
                  <input
                    type="datetime-local"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className={cn(
                      'w-full rounded-lg border border-gray-200 dark:border-border-primary',
                      'bg-white dark:bg-background-primary',
                      'text-gray-900 dark:text-white',
                      'focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent',
                      'transition-all duration-200',
                      'text-sm px-3 py-2.5'
                    )}
                  />
                </div>
                {/* 价格计算 */}
                {renderPriceSection()}
              </div>
            </section>

            {/* 参考素材上传 */}
            <section className="space-y-4">
              <div className="border-b border-gray-100 dark:border-border-primary pb-2" />
              {renderFileUpload()}
            </section>

            {/* 提交按钮 */}
            <div className="pt-4 border-t border-gray-200 dark:border-border-primary">
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate(-1)}
                >
                  取消
                </Button>
                <Button
                  size="lg"
                  icon={<Send size={18} />}
                  loading={submitting}
                  onClick={handleSubmit}
                  className="px-8"
                >
                  提交订单
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </main>

      {/* 支付弹窗 */}
      {renderPaymentModal()}

      <ToastContainer />
    </div>
  );
};

export default CustomOrderPage;
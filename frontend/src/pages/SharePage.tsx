import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Link,
  Share2,
  Image,
  Download,
  Users,
  Gift,
  Check,
  Copy,
  Loader2,
  QrCode,
  MessageCircle,
  Globe,
  Smartphone,
  Crown,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { Button, Card, useToast } from '@/components/shared';
import { cn } from '@/utils';

// ============================================================
// 类型定义
// ============================================================

interface InviteLinkResponse {
  invite_link: string;
}

interface QRCodeResponse {
  qrcode_base64: string;
}

interface PosterResponse {
  poster_base64: string;
}

interface Invitee {
  id: string;
  name: string;
  status: 'PENDING' | 'REGISTERED' | 'REWARDED';
  invited_at: string;
  avatar_url?: string;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  reward_type: string;
  reward_value: string;
  is_claimed: boolean;
  created_at: string;
  claimed_at?: string;
}

// ============================================================
// 状态标签配置
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: '待注册',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  REGISTERED: {
    label: '已注册',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  REWARDED: {
    label: '已奖励',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

// ============================================================
// 常量
// ============================================================

const USER_ID = 'user-001';

// ============================================================
// 主组件
// ============================================================

export const SharePage: React.FC = () => {
  const navigate = useNavigate();
  const { show, ToastContainer } = useToast();

  // ---- 邀请链接状态 ----
  const [inviteLink, setInviteLink] = useState<string>('');
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ---- 二维码状态 ----
  const [qrcodeBase64, setQrcodeBase64] = useState<string>('');
  const [qrcodeLoading, setQrcodeLoading] = useState(false);
  const [qrcodeError, setQrcodeError] = useState<string | null>(null);

  // ---- 海报状态 ----
  const [posterBase64, setPosterBase64] = useState<string>('');
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);

  // ---- 邀请记录状态 ----
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [inviteesLoading, setInviteesLoading] = useState(false);
  const [inviteesError, setInviteesError] = useState<string | null>(null);

  // ---- 奖励记录状态 ----
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // ============================================================
  // 数据获取函数
  // ============================================================

  // 获取邀请链接
  const fetchInviteLink = useCallback(async () => {
    setInviteLinkLoading(true);
    setInviteLinkError(null);
    try {
      const response = await apiClient.get<{ data?: InviteLinkResponse }>(
        `/api/share/invite-link?user_id=${USER_ID}`
      );
      const link = response.data?.data?.invite_link;
      if (link) {
        setInviteLink(link);
      } else {
        throw new Error('获取邀请链接失败：返回数据为空');
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || '获取邀请链接失败';
      setInviteLinkError(msg);
      show({ message: msg, type: 'error' });
    } finally {
      setInviteLinkLoading(false);
    }
  }, [show]);

  // 获取二维码
  const fetchQRCode = useCallback(async () => {
    setQrcodeLoading(true);
    setQrcodeError(null);
    try {
      const response = await apiClient.get<{ data?: QRCodeResponse }>(
        `/api/share/qrcode?user_id=${USER_ID}`
      );
      const base64 = response.data?.data?.qrcode_base64;
      if (base64) {
        setQrcodeBase64(base64);
      } else {
        throw new Error('获取二维码失败：返回数据为空');
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || '获取二维码失败';
      setQrcodeError(msg);
      show({ message: msg, type: 'error' });
    } finally {
      setQrcodeLoading(false);
    }
  }, [show]);

  // 生成海报
  const handleGeneratePoster = useCallback(async () => {
    setPosterLoading(true);
    setPosterError(null);
    try {
      const response = await apiClient.post<{ data?: PosterResponse }>('/api/share/poster', {
        user_id: USER_ID,
      });
      const base64 = response.data?.data?.poster_base64;
      if (base64) {
        setPosterBase64(base64);
        show({ message: '海报生成成功', type: 'success' });
      } else {
        throw new Error('生成海报失败：返回数据为空');
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || '生成海报失败';
      setPosterError(msg);
      show({ message: msg, type: 'error' });
    } finally {
      setPosterLoading(false);
    }
  }, [show]);

  // 获取邀请记录
  const fetchInvitees = useCallback(async () => {
    setInviteesLoading(true);
    setInviteesError(null);
    try {
      const response = await apiClient.get<{ data?: Invitee[] }>(
        `/api/share/invitees?user_id=${USER_ID}`
      );
      const list = response.data?.data;
      if (Array.isArray(list)) {
        setInvitees(list);
      } else {
        setInvitees([]);
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || '获取邀请记录失败';
      setInviteesError(msg);
      show({ message: msg, type: 'error' });
    } finally {
      setInviteesLoading(false);
    }
  }, [show]);

  // 获取奖励记录
  const fetchRewards = useCallback(async () => {
    setRewardsLoading(true);
    setRewardsError(null);
    try {
      const response = await apiClient.get<{ data?: Reward[] }>(
        `/api/share/rewards?user_id=${USER_ID}`
      );
      const list = response.data?.data;
      if (Array.isArray(list)) {
        setRewards(list);
      } else {
        setRewards([]);
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || '获取奖励记录失败';
      setRewardsError(msg);
      show({ message: msg, type: 'error' });
    } finally {
      setRewardsLoading(false);
    }
  }, [show]);

  // ============================================================
  // 初始加载
  // ============================================================

  useEffect(() => {
    fetchInviteLink();
    fetchQRCode();
    fetchInvitees();
    fetchRewards();
  }, [fetchInviteLink, fetchQRCode, fetchInvitees, fetchRewards]);

  // ============================================================
  // 交互函数
  // ============================================================

  // 复制链接到剪贴板
  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      show({ message: '链接已复制到剪贴板', type: 'success' });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error: any) {
      show({ message: '复制链接失败，请手动复制', type: 'error' });
    }
  };

  // 多渠道分享：复制链接
  const handleShareToChannel = (channel: string) => {
    switch (channel) {
      case 'wechat':
        show({ message: '微信分享功能即将上线', type: 'info' });
        break;
      case 'moments':
        show({ message: '朋友圈分享功能即将上线', type: 'info' });
        break;
      case 'copy':
        handleCopyLink();
        break;
      case 'browser':
        show({ message: '浏览器跳转功能即将上线', type: 'info' });
        break;
      default:
        break;
    }
  };

  // 领取奖励
  const handleClaimReward = async (rewardId: string) => {
    setClaimingId(rewardId);
    try {
      await apiClient.post(`/api/share/rewards/${rewardId}/claim`);
      show({ message: '奖励领取成功', type: 'success' });
      // 刷新奖励列表
      fetchRewards();
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || '领取奖励失败';
      show({ message: msg, type: 'error' });
    } finally {
      setClaimingId(null);
    }
  };

  // ============================================================
  // 渲染函数
  // ============================================================

  // 渲染邀请链接模块
  const renderInviteLinkSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
        <Link size={18} className="text-banana-600 dark:text-banana" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">邀请链接</h2>
      </div>
      <Card className="p-4 bg-gray-50 dark:bg-background-hover">
        {inviteLinkLoading ? (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 size={18} className="text-banana-600 dark:text-banana animate-spin" />
            <span className="text-sm text-gray-500 dark:text-foreground-tertiary">
              加载中...
            </span>
          </div>
        ) : inviteLinkError ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <p className="text-sm text-red-500 dark:text-red-400">{inviteLinkError}</p>
            <Button size="sm" variant="secondary" onClick={fetchInviteLink}>
              重试
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white font-mono truncate">
                {inviteLink}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={linkCopied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyLink}
              className="flex-shrink-0"
            >
              {linkCopied ? '已复制' : '复制'}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );

  // 渲染二维码模块
  const renderQRCodeSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
        <QrCode size={18} className="text-banana-600 dark:text-banana" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">推广二维码</h2>
      </div>
      <Card className="p-6 bg-gray-50 dark:bg-background-hover">
        {qrcodeLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={24} className="text-banana-600 dark:text-banana animate-spin" />
            <span className="text-sm text-gray-500 dark:text-foreground-tertiary">
              加载二维码...
            </span>
          </div>
        ) : qrcodeError ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <p className="text-sm text-red-500 dark:text-red-400">{qrcodeError}</p>
            <Button size="sm" variant="secondary" onClick={fetchQRCode}>
              重试
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <img
              src={`data:image/png;base64,${qrcodeBase64}`}
              alt="推广二维码"
              className="w-40 h-40 object-contain"
              onError={() => {
                setQrcodeError('二维码图片加载失败');
                show({ message: '二维码图片加载失败', type: 'error' });
              }}
            />
            <p className="text-xs text-gray-500 dark:text-foreground-tertiary text-center">
              扫描二维码，分享给好友
            </p>
          </div>
        )}
      </Card>
    </section>
  );

  // 渲染生成海报模块
  const renderPosterSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
        <Image size={18} className="text-banana-600 dark:text-banana" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">生成海报</h2>
      </div>
      <Card className="p-4 bg-gray-50 dark:bg-background-hover">
        {!posterBase64 ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <Image size={40} className="text-gray-300 dark:text-foreground-tertiary" />
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary text-center">
              点击下方按钮生成专属推广海报
            </p>
            <Button
              size="md"
              icon={<Image size={16} />}
              loading={posterLoading}
              onClick={handleGeneratePoster}
            >
              生成海报
            </Button>
            {posterError && (
              <p className="text-sm text-red-500 dark:text-red-400">{posterError}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-xs rounded-lg overflow-hidden border border-gray-200 dark:border-border-primary">
              <img
                src={`data:image/png;base64,${posterBase64}`}
                alt="推广海报"
                className="w-full h-auto"
                onError={() => {
                  setPosterError('海报图片加载失败');
                  show({ message: '海报图片加载失败', type: 'error' });
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="secondary"
                icon={<RefreshCw size={14} />}
                loading={posterLoading}
                onClick={handleGeneratePoster}
              >
                重新生成
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download size={14} />}
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = 'poster.png';
                  link.href = `data:image/png;base64,${posterBase64}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  show({ message: '海报已下载', type: 'success' });
                }}
              >
                下载海报
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );

  // 渲染多渠道分享模块
  const renderShareChannelsSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
        <Share2 size={18} className="text-banana-600 dark:text-banana" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">多渠道分享</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 微信分享 */}
        <Card
          hoverable
          className="p-4 cursor-pointer text-center transition-all duration-200 hover:bg-green-50 dark:hover:bg-green-900/10"
          onClick={() => handleShareToChannel('wechat')}
        >
          <MessageCircle size={24} className="mx-auto text-green-500 mb-2" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">微信</p>
        </Card>

        {/* 朋友圈分享 */}
        <Card
          hoverable
          className="p-4 cursor-pointer text-center transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/10"
          onClick={() => handleShareToChannel('moments')}
        >
          <Globe size={24} className="mx-auto text-blue-500 mb-2" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">朋友圈</p>
        </Card>

        {/* 复制链接 */}
        <Card
          hoverable
          className="p-4 cursor-pointer text-center transition-all duration-200 hover:bg-purple-50 dark:hover:bg-purple-900/10"
          onClick={() => handleShareToChannel('copy')}
        >
          <Copy size={24} className="mx-auto text-purple-500 mb-2" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">复制链接</p>
        </Card>

        {/* 浏览器跳转 */}
        <Card
          hoverable
          className="p-4 cursor-pointer text-center transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-900/10"
          onClick={() => handleShareToChannel('browser')}
        >
          <Smartphone size={24} className="mx-auto text-orange-500 mb-2" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">浏览器</p>
        </Card>
      </div>
    </section>
  );

  // 渲染邀请记录模块
  const renderInviteesSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
        <Users size={18} className="text-banana-600 dark:text-banana" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">邀请记录</h2>
      </div>
      <Card className="p-4 bg-gray-50 dark:bg-background-hover">
        {inviteesLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={24} className="text-banana-600 dark:text-banana animate-spin" />
            <span className="text-sm text-gray-500 dark:text-foreground-tertiary">
              加载邀请记录...
            </span>
          </div>
        ) : inviteesError ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <p className="text-sm text-red-500 dark:text-red-400">{inviteesError}</p>
            <Button size="sm" variant="secondary" onClick={fetchInvitees}>
              重试
            </Button>
          </div>
        ) : invitees.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <Users size={32} className="text-gray-300 dark:text-foreground-tertiary" />
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
              暂无邀请记录
            </p>
            <p className="text-xs text-gray-400 dark:text-foreground-tertiary">
              分享链接给好友，邀请他们注册吧
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitees.map((invitee) => (
              <div
                key={invitee.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-background-primary"
              >
                {/* 头像 */}
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-background-hover flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {invitee.avatar_url ? (
                    <img
                      src={invitee.avatar_url}
                      alt={invitee.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Users size={18} className="text-gray-400 dark:text-foreground-tertiary" />
                  )}
                </div>
                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {invitee.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-foreground-tertiary">
                    {new Date(invitee.invited_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {/* 状态标签 */}
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                    STATUS_CONFIG[invitee.status]?.className || ''
                  )}
                >
                  {STATUS_CONFIG[invitee.status]?.label || invitee.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );

  // 渲染奖励记录模块
  const renderRewardsSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-border-primary">
        <Gift size={18} className="text-banana-600 dark:text-banana" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">奖励记录</h2>
      </div>
      <Card className="p-4 bg-gray-50 dark:bg-background-hover">
        {rewardsLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={24} className="text-banana-600 dark:text-banana animate-spin" />
            <span className="text-sm text-gray-500 dark:text-foreground-tertiary">
              加载奖励记录...
            </span>
          </div>
        ) : rewardsError ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <p className="text-sm text-red-500 dark:text-red-400">{rewardsError}</p>
            <Button size="sm" variant="secondary" onClick={fetchRewards}>
              重试
            </Button>
          </div>
        ) : rewards.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <Gift size={32} className="text-gray-300 dark:text-foreground-tertiary" />
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
              暂无奖励记录
            </p>
            <p className="text-xs text-gray-400 dark:text-foreground-tertiary">
              邀请好友注册即可获得奖励
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-background-primary"
              >
                {/* 奖励图标 */}
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <Crown size={18} className="text-yellow-600 dark:text-yellow-400" />
                </div>
                {/* 奖励信息 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {reward.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-foreground-tertiary truncate">
                    {reward.description}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-foreground-tertiary mt-0.5">
                    {reward.reward_type === 'credit' ? '积分' : reward.reward_type}：{reward.reward_value}
                    {' · '}
                    {new Date(reward.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </p>
                </div>
                {/* 领取按钮 */}
                {reward.is_claimed ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0">
                    已领取
                  </span>
                ) : (
                  <Button
                    size="sm"
                    icon={<Gift size={14} />}
                    loading={claimingId === reward.id}
                    onClick={() => handleClaimReward(reward.id)}
                    className="flex-shrink-0"
                  >
                    领取
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );

  // ============================================================
  // 主渲染
  // ============================================================

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
            宣传分享
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary ml-9">
          分享邀请链接，推广您的作品，获取更多奖励
        </p>
      </div>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 pb-16 space-y-8">
        <Card className="p-6 md:p-10 bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-2xl dark:shadow-none border-0 dark:border dark:border-border-primary">
          <div className="space-y-8">
            {/* 邀请链接 */}
            {renderInviteLinkSection()}

            {/* 二维码 */}
            <div className="border-b border-gray-100 dark:border-border-primary" />
            {renderQRCodeSection()}

            {/* 生成海报 */}
            <div className="border-b border-gray-100 dark:border-border-primary" />
            {renderPosterSection()}

            {/* 多渠道分享 */}
            <div className="border-b border-gray-100 dark:border-border-primary" />
            {renderShareChannelsSection()}

            {/* 邀请记录 */}
            <div className="border-b border-gray-100 dark:border-border-primary" />
            {renderInviteesSection()}

            {/* 奖励记录 */}
            <div className="border-b border-gray-100 dark:border-border-primary" />
            {renderRewardsSection()}
          </div>
        </Card>
      </main>

      <ToastContainer />
    </div>
  );
};

export default SharePage;
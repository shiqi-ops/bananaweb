import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, useToast } from '@/components/shared';
import { createNewModeJob } from '@/api/endpoints';

interface NewModeFormProps {
  defaultRequirement?: string;
  defaultTitle?: string;
  onCreated: (jobId: string) => void;
}

const PAGE_CHOICES = [5, 10, 15, 20];
const SCENARIO_CHOICES = ['', '产品汇报', '教学课件', '商业路演', '工作总结', '毕业答辩', '学术报告', '方案提案'];

/**
 * 新模式生成表单：输入需求 → 创建任务（后端：Dify 工作流生成成品 PPT → AI 诊断）
 */
export const NewModeForm: React.FC<NewModeFormProps> = ({
  defaultRequirement = '',
  defaultTitle = '',
  onCreated,
}) => {
  const { show } = useToast();
  const [requirement, setRequirement] = useState(defaultRequirement);
  const [title, setTitle] = useState(defaultTitle);
  const [pageCount, setPageCount] = useState(10);
  const [scenario, setScenario] = useState('');
  const [styleDescription, setStyleDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = requirement.trim();
    if (!trimmed) {
      show({ message: '请先填写你的需求描述', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const response = await createNewModeJob({
        requirement: trimmed,
        title: title.trim() || undefined,
        page_count: pageCount,
        usage_scenario: scenario || undefined,
        style_description: styleDescription.trim() || undefined,
      });
      if (response.data?.task_id) {
        show({ message: '任务已创建，正在生成 PPT...', type: 'success' });
        onCreated(response.data.task_id);
      } else {
        show({ message: response.message || '创建失败', type: 'error' });
      }
    } catch (error: any) {
      console.error('创建新模式任务失败:', error);
      const msg = error?.response?.data?.message || error?.message || '创建失败';
      show({ message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-400/60 dark:focus:ring-banana/40 transition-all';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
          你的需求<span className="text-red-500"> *</span>
        </label>
        <textarea
          rows={4}
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder="例如：生成一份关于 AI 发展史的 PPT，包含起源、三次浪潮、当前大模型时代与未来展望……"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
            标题（可选）
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="AI 发展史"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
            使用场景（可选）
          </label>
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} className={inputCls}>
            {SCENARIO_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s || '请选择场景（可留空）'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
          期望页数
        </label>
        <div className="flex flex-wrap gap-2">
          {PAGE_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPageCount(n)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                pageCount === n
                  ? 'bg-banana-500 text-black border-banana-500 dark:bg-banana dark:border-banana'
                  : 'bg-white dark:bg-background-elevated border-gray-200 dark:border-border-primary text-gray-600 dark:text-foreground-secondary hover:border-banana-400'
              }`}
            >
              {n} 页
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
          风格描述（可选，默认现代商务风）
        </label>
        <textarea
          rows={2}
          value={styleDescription}
          onChange={(e) => setStyleDescription(e.target.value)}
          placeholder="例如：科技感、深蓝渐变主色调、简洁有设计感……"
          className={inputCls}
        />
      </div>

      <Button
        variant="primary"
        size="md"
        icon={<Sparkles size={18} />}
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
      >
        {submitting ? '创建中...' : '开始生成（新模式）'}
      </Button>

      <p className="text-xs text-gray-400 dark:text-foreground-tertiary leading-relaxed">
        新模式流程：需求 → AI 一键生成成品 PPT → AI 自动诊断并给出评分与改进报告。
        若相关服务未配置，后端会以「占位模式」生成，方便预览完整流程。
      </p>
    </div>
  );
};

export default NewModeForm;

import json
import uuid
import logging
from datetime import datetime
from sqlalchemy import String, Column, Text, DateTime, Integer

from models import db


class NewModeTask(db.Model):
    """
    新模式（Dify 生成）任务。

    流程: PENDING → GENERATING (调用 Dify 工作流产出 PPTX)
                → DIAGNOSING (复用原 AI 诊断 DiagnosisTask 检查)
                → COMPLETED / FAILED
    与 Project 解耦：新模式交付物是一份成品 PPTX 文件 + AI 诊断报告，
    不产生逐页图片画布（区别于传统模式的 Project/Page 模型）。
    """
    __tablename__ = 'new_mode_task'

    id                = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id           = Column(String(36), nullable=True)
    requirement       = Column(Text, nullable=False)                # 用户需求描述
    title             = Column(String(200), nullable=True)          # 展示标题（可由需求截取）
    page_count        = Column(Integer, default=10, nullable=False) # 期望页数
    usage_scenario    = Column(String(200), nullable=True)          # 使用场景
    style_description = Column(Text, nullable=True)                 # 风格描述
    engine            = Column(String(20), default='dify', nullable=False)  # dify / placeholder
    status            = Column(String(20), default='PENDING', nullable=False)
    note              = Column(Text, nullable=True)                 # 进度/引擎说明
    file_path         = Column(String(500), nullable=True)          # 生成的 PPTX 绝对路径
    file_name         = Column(String(255), nullable=True)          # 下载文件名
    diagnosis_task_id = Column(String(36), nullable=True)           # 关联的原诊断任务
    score             = Column(Integer, nullable=True)              # AI 诊断评分 0-100
    summary           = Column(Text, nullable=True)                 # AI 诊断摘要
    result            = Column(Text, nullable=True)                 # 冗余的诊断 JSON（可选）
    error_message     = Column(Text, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    completed_at      = Column(DateTime, nullable=True)

    def to_dict(self):
        result_data = None
        if self.result:
            try:
                result_data = json.loads(self.result)
            except (json.JSONDecodeError, TypeError):
                result_data = self.result

        return {
            'id': self.id,
            'user_id': self.user_id,
            'requirement': self.requirement,
            'title': self.title,
            'page_count': self.page_count,
            'usage_scenario': self.usage_scenario,
            'style_description': self.style_description,
            'engine': self.engine,
            'status': self.status,
            'note': self.note,
            'file_name': self.file_name,
            'diagnosis_task_id': self.diagnosis_task_id,
            'score': self.score,
            'summary': self.summary,
            'result': result_data,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def get_by_id(cls, task_id):
        try:
            if not task_id:
                return None
            return cls.query.filter_by(id=task_id).first()
        except Exception as e:
            logging.error(f"NewModeTask.get_by_id error: {e}")
            return None

    @classmethod
    def create_task(cls, data):
        try:
            db.session.add(data)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(f"NewModeTask.create_task error: {e}")
            return False

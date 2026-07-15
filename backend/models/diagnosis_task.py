from uuid import uuid4

import utcnow
from sqlalchemy import String, Column, Text, DateTime

from models import db


class DiagnosisTask(db.Model):
    __tablename__ = 'diagnosis_task'

    id              = Column(String(36), primary_key=True, default=uuid4)
    user_id         = Column(String(36), nullable=True)
    file_path       = Column(String(500), nullable=False)        # 待诊断的PPT/PDF文件路径
    file_type       = Column(String(10), nullable=False)         # pptx / pdf
    diagnosis_options = Column(Text, nullable=False)              # JSON: ["layout", "color", "logic", "text"]
    status          = Column(String(20), default='PENDING')      # PENDING / PROCESSING / COMPLETED / FAILED
    result          = Column(Text, nullable=True)                 # JSON: 诊断结果详情
    error_message   = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=utcnow)
    completed_at    = Column(DateTime, nullable=True)
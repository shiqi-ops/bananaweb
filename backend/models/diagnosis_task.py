import json
import uuid
import logging
from datetime import datetime
from sqlalchemy import String, Column, Text, DateTime

from models import db


class DiagnosisTask(db.Model):
    __tablename__ = 'diagnosis_task'

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String(36), nullable=True)
    file_path       = Column(String(500), nullable=False)        # 待诊断的PPT/PDF文件路径
    file_type       = Column(String(10), nullable=False)         # pptx / pdf
    diagnosis_options = Column(Text, nullable=False)              # JSON: ["layout", "color", "logic", "text"]
    status          = Column(String(20), default='PENDING')      # PENDING / PROCESSING / COMPLETED / FAILED
    result          = Column(Text, nullable=True)                 # JSON: 诊断结果详情
    error_message   = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    completed_at    = Column(DateTime, nullable=True)

    def to_dict(self):
        result_data = None
        if self.result:
            try:
                result_data = json.loads(self.result)
            except (json.JSONDecodeError, TypeError):
                result_data = self.result

        return {
            'id': self.id,
            'task_id': self.id,
            'user_id': self.user_id,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'diagnosis_options': self.diagnosis_options,
            'status': self.status,
            'result': result_data,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
    @classmethod
    def get_by_id(cls, id):
        try:
            if id is None:
                return None
            diagnosis = cls.query.filter_by(id=id).first()
            if diagnosis is None:
                return None
            return diagnosis
        except Exception as e:
            logging.error(e)
            return None
    @classmethod
    def create_task(cls,data):
        try:
            db.session.add(data)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
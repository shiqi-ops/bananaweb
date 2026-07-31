import logging
import uuid
from datetime import datetime
from sqlalchemy import String, Column, Text, Float, Boolean, Integer, DateTime

from models import db


class Mentor(db.Model):
    __tablename__ = 'mentor'

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name            = Column(String(100), nullable=False)        # 导师姓名
    title           = Column(String(200), nullable=True)         # 职称/头衔
    specialty       = Column(Text, nullable=True)                # 专长领域
    avatar_url      = Column(String(500), nullable=True)         # 头像URL
    description     = Column(Text, nullable=True)                # 个人简介
    price_per_hour  = Column(Float, nullable=False)              # 每小时价格
    is_active       = Column(Boolean, default=True)              # 是否上架
    sort_order      = Column(Integer, default=0)                 # 排序权重
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'specialty': self.specialty,
            'avatar_url': self.avatar_url,
            'description': self.description,
            'price_per_hour': self.price_per_hour,
            'is_active': self.is_active,
            'sort_order': self.sort_order,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }
    @classmethod
    def get_all(cls):
        try:
            return cls.query.all()
        except Exception as e:
            logging.error(e)
            return None
    @classmethod
    def get_by_id(cls, id):
        try:
            return cls.query.filter_by(id=id).first()
        except Exception as e:
            logging.error(e)
            return None

from uuid import uuid4

import utcnow
from sqlalchemy import String, Column, Text, Float, Boolean, Integer, DateTime

from models import db


class Mentor(db.Model):
    __tablename__ = 'mentor'

    id              = Column(String(36), primary_key=True, default=uuid4)
    name            = Column(String(100), nullable=False)        # 导师姓名
    title           = Column(String(200), nullable=True)         # 职称/头衔
    specialty       = Column(Text, nullable=True)                # 专长领域
    avatar_url      = Column(String(500), nullable=True)         # 头像URL
    description     = Column(Text, nullable=True)                # 个人简介
    price_per_hour  = Column(Float, nullable=False)              # 每小时价格
    is_active       = Column(Boolean, default=True)              # 是否上架
    sort_order      = Column(Integer, default=0)                 # 排序权重
    created_at      = Column(DateTime, default=utcnow)
    updated_at      = Column(DateTime, default=utcnow, onupdate=utcnow)
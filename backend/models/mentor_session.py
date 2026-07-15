from uuid import uuid4

import utcnow
from sqlalchemy import Column, String, ForeignKey, Integer, DateTime, Float, Text
from sqlalchemy.orm import relationship

from models import db


class MentorSession(db.Model):
    __tablename__ = 'mentor_session'

    id = Column(String(36), primary_key=True, default=uuid4)
    user_id = Column(String(36), nullable=True)
    mentor_id = Column(String(36), ForeignKey('mentors.id'), nullable=False)
    contact_name = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(200), nullable=True)
    duration_minutes = Column(Integer, nullable=False)  # 服务时长（分钟）
    scheduled_start = Column(DateTime, nullable=False)  # 预约开始时间
    scheduled_end = Column(DateTime, nullable=False)  # 预约结束时间
    price = Column(Float, nullable=False)  # 费用
    status = Column(String(20), default='PENDING')  # PENDING / CONFIRMED / COMPLETED / CANCELLED
    payment_status = Column(String(20), default='UNPAID')  # UNPAID / PAID / REFUNDED
    notes = Column(Text, nullable=True)  # 用户备注
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    mentor = relationship('Mentor', backref='sessions')
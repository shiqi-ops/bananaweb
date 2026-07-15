import uuid

import utcnow
from sqlalchemy import Column, String, Text, Integer, DateTime, Float

from models import db


class CustomOrder(db.Model):
    __tablename__ = 'custom_order'
    id = Column(String(36), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(36), nullable=True)  # 关联用户（如有用户体系）
    contact_name = Column(String(100), nullable=False)  # 联系人姓名
    contact_phone = Column(String(20), nullable=True)  # 联系电话
    contact_email = Column(String(200), nullable=True)  # 联系邮箱
    requirement = Column(Text, nullable=False)  # 需求描述
    page_count = Column(Integer, nullable=True)  # 期望页数
    usage_scenario = Column(String(100), nullable=True)  # 使用场景
    style_id = Column(String(36), nullable=True)  # 选择的风格模板
    mentor_id = Column(String(36), nullable=True)  # 选择的导师
    deadline = Column(DateTime, nullable=True)  # 交付截止时间
    price = Column(Float, nullable=True)  # 报价金额
    status = Column(String(20), default='PENDING')  # PENDING / PAID / IN_PROGRESS / COMPLETED / CANCELLED
    payment_status = Column(String(20), default='UNPAID')  # UNPAID / PAID / REFUNDED
    reference_files = Column(Text, nullable=True)  # JSON: 参考素材文件路径列表
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

import logging
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Integer, DateTime, Float

from models import db


class CustomOrder(db.Model):
    __tablename__ = 'custom_order'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'requirement': self.requirement,
            'page_count': self.page_count,
            'usage_scenario': self.usage_scenario,
            'style_id': self.style_id,
            'mentor_id': self.mentor_id,
            'deadline': self.deadline,
            'price': self.price,
            'status': self.status,
            'payment_status': self.payment_status,
            'reference_files': self.reference_files,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }

    @classmethod
    def create_order(cls,data):
        try:
            db.session.add(data)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
    @classmethod
    def get_by_id(cls, id):
        try:
            order=cls.query.filter_by(id=id).first()
            if not order:
                return None
            return order
        except Exception as e:
            logging.error(e)
            return None
    @classmethod
    def update_by_id(cls,data):
        try:
            order=cls.query.filter_by(id=data['id']).first()
            if order.status != 'PENDING':
                return False
            row_change=cls.query.filter_by(id=data['id']).update(data)
            if row_change==0:
                return False
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
    @classmethod
    def delete_by_id(cls, id):
        try:
            row_change=cls.query.filter_by(id=id).delete()
            if row_change==0:
                return False
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
    @classmethod
    def get_pay_status_by_id(cls, id):
        try:
            order=cls.query.filter_by(id=id).first()
            if not order:
                return None
            return order.payment_status
        except Exception as e:
            logging.error(e)
            return None

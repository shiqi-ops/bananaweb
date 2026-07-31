import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, Integer, DateTime, Float, Text
from sqlalchemy.orm import relationship
from models import db
import logging

class MentorSession(db.Model):
    __tablename__ = 'mentor_session'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True)
    mentor_id = Column(String(36), ForeignKey('mentor.id'), nullable=False)
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    mentor = relationship('Mentor', backref='sessions')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'mentor_id': self.mentor_id,
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'scheduled_start': self.scheduled_start,
            'scheduled_end': self.scheduled_end,
            'price': self.price,
            'status': self.status,
            'payment_status': self.payment_status,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }

    @classmethod
    def create_session(cls,data):
        try:
            db.session.add(data)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
    @classmethod
    def get_sessions_by_id(cls,id):
        try:
            if not id:
                return None
            result=cls.query.filter_by(id=id).first()
            if result:
                return result
            else:
                return None
        except Exception as e:
            logging.error(e)
            return None
    @classmethod
    def update_session_by_id(cls,data):
        try:
            if not data:
                return False
            result = cls.query.filter_by(id=data['id']).update(data)
            if result!=0:
                db.session.commit()
                return True
            else:
                return False
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
    @classmethod
    def delete_session_by_id(cls,id):
        try:
            if not id:
                return False
            result = cls.query.filter_by(id=id).first()
            if result:
                db.session.delete(result)
                db.session.commit()
                return True
            else:
                return False
        except Exception as e:
            db.session.rollback()
            logging.error(e)
            return False
    @classmethod
    def get_payment_status(cls,id):
        try:
            if not id:
                return None
            result = cls.query.filter_by(id=id).first()
            if result:
                return result.payment_status
            else:
                return None
        except Exception as e:
            logging.error(e)
            return None
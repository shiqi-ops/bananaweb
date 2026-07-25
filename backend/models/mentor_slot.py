import uuid
from uuid import uuid4

import utcnow
from sqlalchemy import String, Column, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship

from models import db


class MentorSlot(db.Model):
    __tablename__ = 'mentor_slot'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mentor_id = Column(String(36), ForeignKey('mentor.id'), nullable=False)
    start_time = Column(DateTime, nullable=False)  # 可预约开始时间
    end_time = Column(DateTime, nullable=False)  # 可预约结束时间
    is_booked = Column(Boolean, default=False)  # 是否已被预约
    created_at = Column(DateTime, default=utcnow)

    mentor = relationship('Mentor', backref='slots')
    @classmethod
    def get_slot_by_mentor_id(cls, id):
        return cls.query.get(mentor_id=id).first()
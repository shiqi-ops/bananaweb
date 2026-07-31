import uuid
from uuid import uuid4

import utcnow
from sqlalchemy import String, Column, Float, ForeignKey, Boolean, DateTime

from models import db


class Reward(db.Model):
    __tablename__ = 'reward'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False)  # 获得奖励的用户
    reward_type = Column(String(50), nullable=False)  # CREDITS / FREE_ORDER / DISCOUNT / VIP_DAYS
    amount = Column(Float, nullable=True)  # 奖励数量
    description = Column(String(500), nullable=True)  # 奖励描述
    source_invite_id = Column(String(36), ForeignKey('invite_records.id'), nullable=True)
    is_claimed = Column(Boolean, default=False)  # 是否已领取
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reward_type': self.reward_type,
            'amount': self.amount,
            'description': self.description,
            'source_invite_id': self.source_invite_id,
            'is_claimed': self.is_claimed,
            'created_at': self.created_at,
        }
    @classmethod
    def get_by_user_id(cls, user_id):
        return cls.query.filter_by(user_id=user_id).all()
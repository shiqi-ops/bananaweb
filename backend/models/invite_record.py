import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime

from models import db


class InviteRecord(db.Model):
    __tablename__ = 'invite_records'

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    inviter_user_id = Column(String(36), nullable=False)          # 邀请人
    invitee_user_id = Column(String(36), nullable=True)           # 被邀请人（注册后回填）
    invite_code     = Column(String(20), unique=True, nullable=False)  # 邀请码
    name            = Column(String(100), nullable=True)          # 被邀请人名称
    status          = Column(String(20), default='PENDING')       # PENDING / REGISTERED / REWARDED
    reward_granted  = Column(Boolean, default=False)              # 奖励是否已发放
    created_at      = Column(DateTime, default=datetime.utcnow)
    registered_at   = Column(DateTime, nullable=True)             # 被邀请人注册时间
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name or self.invite_code or '未知用户',
            'inviter_user_id': self.inviter_user_id,
            'invitee_user_id': self.invitee_user_id,
            'invite_code': self.invite_code,
            'status': self.status,
            'invited_at': (self.created_at.isoformat() if self.created_at else None),
            'reward_granted': self.reward_granted,
            'created_at': self.created_at,
            'registered_at': self.registered_at
        }
    @classmethod
    def get_by_inviter(cls,invite_user_id):
        return cls.query.filter_by(inviter_user_id=invite_user_id).all()
    @classmethod
    def get_by_invite_code(cls, invite_code):
        return cls.query.filter_by(invite_code=invite_code).first()